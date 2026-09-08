/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// --- Reusable Rams Confirmation Dialog ---
function ConfirmModal({ isOpen, title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', isDanger = false, onConfirm, onCancel }) {
    if (!isOpen) return null
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[10000] flex items-center justify-center p-4">
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] max-w-sm w-full p-5 rounded-sm shadow-xl font-sans">
                <h3 className="font-mono text-sm font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">{title}</h3>
                <p className="text-xs text-[oklch(42%_0.010_28)] font-sans mt-2 whitespace-pre-line leading-relaxed">{message}</p>
                <div className="flex gap-2 mt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-3 py-2 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] text-xs font-mono font-bold uppercase rounded-sm hover:bg-[oklch(90%_0.012_28)] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-sm transition-colors duration-150 cursor-pointer text-[oklch(97%_0.008_28)] focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)] ${
                            isDanger
                                ? 'bg-red-700 hover:bg-red-800'
                                : 'bg-[oklch(18%_0.012_28)] hover:bg-[oklch(14%_0.010_28)]'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default function OptionGroupList() {
    const [groups, setGroups] = useState([])
    const [linkedCounts, setLinkedCounts] = useState({})
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)
    const [expandedGroup, setExpandedGroup] = useState(null)

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        is_required: false,
        selection_type: 'single',
        min_selection: 0,
        max_selection: 1
    })

    // Selection Limit Mode: '1' (Single), 'limit' (Multiple with max), 'unlimited' (Any)
    const [limitMode, setLimitMode] = useState('1')

    // Choices for the current group being edited
    const [choices, setChoices] = useState([])

    // Confirmation dialog state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'ยืนยัน',
        isDanger: false,
        onConfirm: () => {}
    })

    useEffect(() => {
        fetchGroups(true)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                if (!isModalOpen) {
                    fetchGroups(false)
                }
            }, 400)
        }

        const channel = supabase
            .channel('admin-option-groups-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_groups' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_choices' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_options' }, debouncedFetch)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [isModalOpen])

    const fetchGroups = async (showLoadingState = false) => {
        if (showLoadingState) setLoading(true)
        try {
            const [groupRes, linkRes] = await Promise.all([
                supabase
                    .from('option_groups')
                    .select(`*, option_choices (*)`)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('menu_item_options')
                    .select('option_group_id')
            ])

            if (groupRes.error) throw groupRes.error

            const counts = {}
            if (linkRes.data) {
                linkRes.data.forEach(link => {
                    counts[link.option_group_id] = (counts[link.option_group_id] || 0) + 1
                })
            }
            setLinkedCounts(counts)
            setGroups(groupRes.data || [])
        } catch (error) {
            console.error('Fetch option groups error:', error)
            if (showLoadingState) toast.error('ไม่สามารถโหลดกลุ่มตัวเลือกได้')
        } finally {
            if (showLoadingState) setLoading(false)
        }
    }

    const handleEdit = (group) => {
        setEditingGroup(group)

        let mode = '1'
        if (group.max_selection === 1 || group.selection_type === 'single') mode = '1'
        else if (group.max_selection > 1) mode = 'limit'
        else if (group.max_selection === 0) mode = 'unlimited'

        setLimitMode(mode)

        setFormData({
            name: group.name,
            is_required: group.is_required === true,
            selection_type: group.selection_type || 'single',
            min_selection: group.min_selection || 0,
            max_selection: group.max_selection || 1
        })

        const sortedChoices = (group.option_choices || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        setChoices(sortedChoices)
        setIsModalOpen(true)
    }

    const handleCreate = () => {
        setEditingGroup(null)
        setLimitMode('1')
        setFormData({
            name: '',
            is_required: true,
            selection_type: 'single',
            min_selection: 1,
            max_selection: 1
        })
        setChoices([
            { id: `temp_${Date.now()}_1`, name: 'หวานปกติ (100%)', price_modifier: 0, is_available: true, display_order: 0 },
            { id: `temp_${Date.now()}_2`, name: 'หวานน้อย (50%)', price_modifier: 0, is_available: true, display_order: 1 },
            { id: `temp_${Date.now()}_3`, name: 'ไม่หวาน (0%)', price_modifier: 0, is_available: true, display_order: 2 }
        ])
        setIsModalOpen(true)
    }

    const handleDelete = (group) => {
        const usageCount = linkedCounts[group.id] || 0
        const message = usageCount > 0
            ? `กลุ่มตัวเลือก "${group.name}" กำลังเชื่อมโยงอยู่กับเมนูอาหาร ${usageCount} รายการ\nการลบจะทำให้เมนูเหล่านั้นไม่มีตัวเลือกนี้ ยืนยันการลบหรือไม่?`
            : `ยืนยันการลบกลุ่มตัวเลือก "${group.name}" หรือไม่?`

        setConfirmModal({
            isOpen: true,
            title: 'ยืนยันการลบกลุ่มตัวเลือก',
            message,
            confirmText: 'ลบกลุ่มตัวเลือก',
            isDanger: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }))
                try {
                    const { error } = await supabase.from('option_groups').delete().eq('id', group.id)
                    if (error) throw error
                    setGroups(prev => prev.filter(g => g.id !== group.id))
                    toast.success(`ลบกลุ่มตัวเลือก "${group.name}" แล้ว`)
                } catch (error) {
                    console.error('Delete option group error:', error)
                    toast.error('ลบไม่สำเร็จ: ' + error.message)
                }
            }
        })
    }

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault()
        const trimmedName = (formData.name || '').trim()
        if (!trimmedName) {
            toast.error('กรุณาระบุชื่อกลุ่มตัวเลือก')
            return
        }

        const validChoices = choices.filter(c => (c.name || '').trim())
        if (validChoices.length === 0) {
            toast.error('กรุณาระบุตัวเลือกอย่างน้อย 1 รายการ')
            return
        }

        try {
            let groupId = editingGroup?.id

            let finalMin = 0
            let finalMax = 1
            let finalType = 'single'

            if (limitMode === '1') {
                finalMax = 1
                finalType = 'single'
                finalMin = formData.is_required ? 1 : 0
            } else if (limitMode === 'limit') {
                finalMax = Math.max(2, parseInt(formData.max_selection, 10) || 2)
                finalType = 'multiple'
                finalMin = formData.is_required ? 1 : 0
            } else if (limitMode === 'unlimited') {
                finalMax = 0
                finalType = 'multiple'
                finalMin = formData.is_required ? 1 : 0
            }

            const payload = {
                name: trimmedName,
                is_required: formData.is_required,
                selection_type: finalType,
                min_selection: finalMin,
                max_selection: finalMax
            }

            if (editingGroup) {
                const { error } = await supabase.from('option_groups').update(payload).eq('id', groupId)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('option_groups').insert(payload).select().single()
                if (error) throw error
                groupId = data.id
            }

            // Sync Choices safely
            if (groupId) {
                const existingChoiceIds = validChoices
                    .filter(c => c.id && !c.id.toString().startsWith('temp_'))
                    .map(c => c.id)

                if (existingChoiceIds.length > 0) {
                    await supabase
                        .from('option_choices')
                        .delete()
                        .eq('group_id', groupId)
                        .not('id', 'in', `(${existingChoiceIds.join(',')})`)
                } else if (editingGroup) {
                    await supabase.from('option_choices').delete().eq('group_id', groupId)
                }

                const newChoices = validChoices.filter(c => !c.id || c.id.toString().startsWith('temp_'))
                const existingChoices = validChoices.filter(c => c.id && !c.id.toString().startsWith('temp_'))

                if (newChoices.length > 0) {
                    const insertPayload = newChoices.map((c, idx) => ({
                        group_id: groupId,
                        name: c.name.trim(),
                        price_modifier: parseFloat(c.price_modifier || 0),
                        is_available: c.is_available !== false,
                        display_order: existingChoices.length + idx
                    }))
                    const { error: insertError } = await supabase.from('option_choices').insert(insertPayload)
                    if (insertError) throw insertError
                }

                if (existingChoices.length > 0) {
                    for (let idx = 0; idx < existingChoices.length; idx++) {
                        const c = existingChoices[idx]
                        await supabase
                            .from('option_choices')
                            .update({
                                name: c.name.trim(),
                                price_modifier: parseFloat(c.price_modifier || 0),
                                is_available: c.is_available !== false,
                                display_order: idx
                            })
                            .eq('id', c.id)
                    }
                }
            }

            toast.success('บันทึกกลุ่มตัวเลือกเรียบร้อย')
            setIsModalOpen(false)
            fetchGroups()
        } catch (err) {
            console.error('Save option group error:', err)
            toast.error('บันทึกไม่สำเร็จ: ' + err.message)
        }
    }

    // --- Choice Handlers in Modal ---
    const addChoice = () => {
        setChoices(prev => [
            ...prev, 
            { id: `temp_${Date.now()}`, name: '', price_modifier: 0, is_available: true, display_order: prev.length }
        ])
    }

    const updateChoice = (index, field, value) => {
        setChoices(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
    }

    const removeChoice = (index) => {
        setChoices(prev => prev.filter((_, i) => i !== index))
    }

    const moveChoice = (index, direction) => {
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= choices.length) return
        const newChoices = [...choices]
        const temp = newChoices[index]
        newChoices[index] = newChoices[targetIndex]
        newChoices[targetIndex] = temp
        setChoices(newChoices)
    }

    return (
        <div className="text-[oklch(18%_0.012_28)] pb-12 animate-fade-in font-sans">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            Option Groups & Modifiers
                        </h2>
                        <span className="font-mono text-xs text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] px-2 py-0.5 rounded-sm border border-[oklch(85%_0.012_28)] tabular-nums">
                            {groups.length} กลุ่มตัวเลือก
                        </span>
                    </div>
                    <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                        กำหนดตัวเลือกเสริม (ความหวาน, ประเภทนม, ท็อปปิ้ง, ระดับความสุก) และราคาบวกเพิ่ม
                    </p>
                </div>

                <button 
                    onClick={handleCreate} 
                    className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-4 py-2 rounded-xs font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-[oklch(14%_0.010_28)] transition-colors duration-150 shadow-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                >
                    <Plus size={15} /> สร้างกลุ่มตัวเลือก
                </button>
            </div>

            {/* Groups List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-[oklch(94%_0.010_28)] animate-pulse rounded-sm border border-[oklch(85%_0.012_28)]" />
                    ))}
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[oklch(85%_0.012_28)] rounded-sm bg-[oklch(98%_0.004_28)] text-[oklch(55%_0.010_28)] font-mono text-xs">
                    ยังไม่มีกลุ่มตัวเลือก คลิก "สร้างกลุ่มตัวเลือก" เพื่อเริ่มต้น
                </div>
            ) : (
                <div className="space-y-3">
                    {groups.map(group => {
                        const isExpanded = expandedGroup === group.id
                        const choicesList = (group.option_choices || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                        const linkedCount = linkedCounts[group.id] || 0

                        return (
                            <div 
                                key={group.id} 
                                className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] rounded-sm overflow-hidden shadow-xs transition-colors duration-150 hover:border-[oklch(52%_0.16_28)]"
                            >
                                <div
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[oklch(96%_0.006_28)] transition-colors duration-150"
                                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-8 h-8 rounded-xs bg-[oklch(94%_0.010_28)] flex items-center justify-center text-[oklch(55%_0.010_28)] border border-[oklch(85%_0.012_28)] shrink-0">
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-base text-[oklch(18%_0.012_28)] truncate">
                                                    {group.name}
                                                </h3>
                                                {group.is_required && (
                                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded-xs">
                                                        บังคับเลือก
                                                    </span>
                                                )}
                                                <span className="font-mono text-[10px] bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border border-[oklch(85%_0.012_28)] px-1.5 py-0.2 rounded-xs">
                                                    {group.selection_type === 'single' ? 'เลือก 1 อย่าง' : (group.max_selection > 0 ? `เลือกได้สูงสุด ${group.max_selection} อย่าง` : 'เลือกไม่จำกัด')}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs font-mono text-[oklch(55%_0.010_28)] mt-1 tabular-nums">
                                                <span>{choicesList.length} ตัวเลือก</span>
                                                <span>•</span>
                                                <span>ใช้ใน {linkedCount} เมนู</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0" onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={() => handleEdit(group)} 
                                            className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] rounded-xs transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                                            title="แก้ไขกลุ่มตัวเลือก"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(group)} 
                                            className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                                            title="ลบกลุ่มตัวเลือก"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Choices Preview */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="border-t border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-4"
                                        >
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                                {choicesList.map(c => (
                                                    <div 
                                                        key={c.id} 
                                                        className={`p-2.5 rounded-xs border text-xs flex justify-between items-center transition-colors duration-150 ${
                                                            c.is_available === false 
                                                                ? 'bg-[oklch(94%_0.008_28)] border-[oklch(88%_0.010_28)] text-[oklch(55%_0.010_28)] opacity-70' 
                                                                : 'bg-[oklch(98%_0.004_28)] border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="font-bold truncate">{c.name}</span>
                                                            {c.is_available === false && (
                                                                <span className="font-mono text-[9px] text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded-xs">
                                                                    หมด
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-mono font-bold text-[oklch(52%_0.16_28)] shrink-0 ml-2 tabular-nums">
                                                            {c.price_modifier > 0 ? `+฿${c.price_modifier}` : 'ฟรี'}
                                                        </span>
                                                    </div>
                                                ))}
                                                {choicesList.length === 0 && (
                                                    <p className="text-xs font-mono text-[oklch(55%_0.010_28)] italic col-span-full py-2">
                                                        ยังไม่มีตัวเลือกย่อยในกลุ่มนี้
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create / Edit Planar Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[oklch(98%_0.004_28)] w-full max-w-lg rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-[oklch(85%_0.012_28)] flex items-center justify-between bg-[oklch(98%_0.004_28)] z-10">
                            <div>
                                <h3 className="font-mono text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                    {editingGroup ? 'แก้ไขกลุ่มตัวเลือก' : 'สร้างกลุ่มตัวเลือกใหม่'}
                                </h3>
                                <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                                    กำหนดเงื่อนไขการเลือกและรายการตัวเลือกย่อย
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(92%_0.010_28)] rounded-xs cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body: Planar Form Sections */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-[oklch(98%_0.004_28)]">
                            {/* Group Name Input */}
                            <div className="pb-4 border-b border-[oklch(85%_0.012_28)]">
                                <label className="block text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase mb-1.5">
                                    ชื่อกลุ่มตัวเลือก (Group Name) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xs p-2.5 text-sm text-[oklch(18%_0.012_28)] font-bold focus:border-[oklch(52%_0.16_28)] focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)] transition-colors duration-150"
                                    placeholder="เช่น ระดับความหวาน, ประเภทนม, เมล็ดกาแฟ, ท็อปปิ้ง"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Required Toggle (Planar Row) */}
                            <label className="flex items-center justify-between bg-[oklch(97%_0.008_28)] p-3 rounded-xs border border-[oklch(85%_0.012_28)] cursor-pointer hover:bg-[oklch(94%_0.010_28)] transition-colors duration-150">
                                <div className="space-y-0.5">
                                    <div className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                                        ลูกค้าจำเป็นต้องเลือก? (Required)
                                    </div>
                                    <p className="text-[11px] text-[oklch(55%_0.010_28)] font-mono">
                                        หากเปิดไว้ ลูกค้าจะต้องเลือกอย่างน้อย 1 ตัวเลือกก่อนสั่งเมนูนี้ได้
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={formData.is_required}
                                    onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                                    className="w-4 h-4 accent-[oklch(52%_0.16_28)] cursor-pointer"
                                />
                            </label>

                            {/* Selection Rules (Planar Segmented Picker) */}
                            <div className="space-y-2 pb-4 border-b border-[oklch(85%_0.012_28)]">
                                <label className="text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase block">
                                    จำนวนตัวเลือกที่เลือกได้ (Selection Rule)
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* Single */}
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xs border cursor-pointer transition-colors duration-150 ${
                                        limitMode === '1' ? 'bg-[oklch(94%_0.010_28)] border-[oklch(52%_0.16_28)] font-bold' : 'bg-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}>
                                        <input type="radio" checked={limitMode === '1'} onChange={() => setLimitMode('1')} className="accent-[oklch(52%_0.16_28)]" />
                                        <span className="text-xs font-mono text-[oklch(18%_0.012_28)]">1 ตัวเลือก</span>
                                    </label>

                                    {/* Multiple Limited */}
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xs border cursor-pointer transition-colors duration-150 ${
                                        limitMode === 'limit' ? 'bg-[oklch(94%_0.010_28)] border-[oklch(52%_0.16_28)] font-bold' : 'bg-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}>
                                        <input type="radio" checked={limitMode === 'limit'} onChange={() => setLimitMode('limit')} className="accent-[oklch(52%_0.16_28)]" />
                                        <span className="text-xs font-mono text-[oklch(18%_0.012_28)]">หลายตัวเลือก (จำกัด)</span>
                                    </label>

                                    {/* Unlimited */}
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xs border cursor-pointer transition-colors duration-150 ${
                                        limitMode === 'unlimited' ? 'bg-[oklch(94%_0.010_28)] border-[oklch(52%_0.16_28)] font-bold' : 'bg-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}>
                                        <input type="radio" checked={limitMode === 'unlimited'} onChange={() => setLimitMode('unlimited')} className="accent-[oklch(52%_0.16_28)]" />
                                        <span className="text-xs font-mono text-[oklch(18%_0.012_28)]">ไม่จำกัด</span>
                                    </label>
                                </div>

                                {limitMode === 'limit' && (
                                    <div className="flex items-center gap-3 p-2.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xs mt-2">
                                        <span className="text-xs font-mono text-[oklch(42%_0.010_28)]">เลือกได้สูงสุดไม่เกิน:</span>
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, max_selection: Math.max(2, (parseInt(p.max_selection, 10) || 2) - 1) }))}
                                                className="w-9 h-9 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono font-bold text-sm hover:bg-[oklch(90%_0.012_28)] rounded-xs cursor-pointer flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                                            >-</button>
                                            <span className="w-8 text-center font-mono font-bold text-sm tabular-nums">{formData.max_selection || 2}</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, max_selection: (parseInt(p.max_selection, 10) || 2) + 1 }))}
                                                className="w-9 h-9 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono font-bold text-sm hover:bg-[oklch(90%_0.012_28)] rounded-xs cursor-pointer flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                                            >+</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Choices Editor */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase block">
                                            รายการตัวเลือกย่อย (Choices List)
                                        </label>
                                        <span className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">
                                            ใส่ราคา 0 หากไม่คิดเงินเพิ่ม
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addChoice}
                                        className="text-xs font-mono font-bold text-[oklch(52%_0.16_28)] hover:underline flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                                    >
                                        <Plus size={14} /> เพิ่มตัวเลือก
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {choices.map((choice, idx) => (
                                        <div 
                                            key={choice.id || idx} 
                                            className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xs p-2 flex items-center gap-2 shadow-2xs"
                                        >
                                            {/* Reorder Buttons */}
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => moveChoice(idx, -1)}
                                                    disabled={idx === 0}
                                                    className="text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] disabled:opacity-20 p-1 rounded-xs hover:bg-[oklch(92%_0.010_28)] cursor-pointer"
                                                    title="เลื่อนขึ้น"
                                                >
                                                    <ArrowUp size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveChoice(idx, 1)}
                                                    disabled={idx === choices.length - 1}
                                                    className="text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] disabled:opacity-20 p-1 rounded-xs hover:bg-[oklch(92%_0.010_28)] cursor-pointer"
                                                    title="เลื่อนลง"
                                                >
                                                    <ArrowDown size={13} />
                                                </button>
                                            </div>

                                            {/* Choice Name */}
                                            <input
                                                type="text"
                                                value={choice.name}
                                                onChange={e => updateChoice(idx, 'name', e.target.value)}
                                                placeholder="ชื่อตัวเลือก (เช่น หวาน 50%, นมข้าวโอ๊ต)"
                                                className="flex-1 text-xs font-bold text-[oklch(18%_0.012_28)] outline-none bg-transparent placeholder-[oklch(55%_0.010_28)] border-b border-transparent focus:border-[oklch(52%_0.16_28)] py-1"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        addChoice()
                                                    }
                                                }}
                                            />

                                            {/* Price Modifier */}
                                            <div className="flex items-center gap-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xs px-2 py-1">
                                                <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)]">+฿</span>
                                                <input
                                                    type="number"
                                                    value={choice.price_modifier}
                                                    onChange={e => updateChoice(idx, 'price_modifier', e.target.value)}
                                                    className="w-12 bg-transparent text-xs font-mono font-bold outline-none text-right tabular-nums"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* In Stock Toggle */}
                                            <button
                                                type="button"
                                                onClick={() => updateChoice(idx, 'is_available', choice.is_available === false ? true : false)}
                                                className={`px-2 py-1 rounded-xs border text-[10px] font-mono font-bold transition-colors duration-150 cursor-pointer ${
                                                    choice.is_available !== false 
                                                        ? 'bg-green-50 text-green-700 border-green-300' 
                                                        : 'bg-red-50 text-red-700 border-red-300'
                                                }`}
                                                title={choice.is_available !== false ? 'เปิดขาย (มีสต็อก)' : 'ของหมด (Out of Stock)'}
                                            >
                                                {choice.is_available !== false ? 'มีของ' : 'หมด'}
                                            </button>

                                            {/* Delete Choice */}
                                            <button 
                                                type="button"
                                                onClick={() => removeChoice(idx)} 
                                                className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors duration-150 cursor-pointer"
                                                title="ลบตัวเลือกนี้"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-xs uppercase py-2.5 rounded-xs hover:bg-[oklch(90%_0.012_28)] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                            >
                                ยกเลิก
                            </button>
                            <button 
                                type="button"
                                onClick={handleSubmit} 
                                className="flex-1 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono font-bold text-xs uppercase py-2.5 rounded-xs hover:bg-[oklch(14%_0.010_28)] transition-colors duration-150 shadow-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]"
                            >
                                บันทึกกลุ่มตัวเลือก
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Reusable Confirm Dialog */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDanger={confirmModal.isDanger}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    )
}
