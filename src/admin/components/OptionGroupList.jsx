/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import ChoiceIngredientsModal from './ChoiceIngredientsModal'
import { summarizeChoiceIngredients } from '../../utils/optionIngredients'

// --- Reusable Rams Confirmation Dialog ---
function ConfirmModal({ isOpen, title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', isDanger = false, onConfirm, onCancel }) {
    if (!isOpen) return null
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[10000] flex items-center justify-center p-4">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] max-w-sm w-full p-5 rounded-sm shadow-xl font-sans">
                <h3 className="tabular-nums text-sm font-bold tracking-tight text-[var(--color-ink)]">{title}</h3>
                <p className="text-[13px] text-[var(--color-muted)] font-sans mt-2 whitespace-pre-line leading-relaxed">{message}</p>
                <div className="flex gap-2 mt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="admin-btn h-9 flex-1"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 px-3 py-2 text-xs tabular-nums font-bold rounded-sm transition-colors duration-150 cursor-pointer text-[var(--color-paper)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] ${
                            isDanger
                                ? 'bg-red-700 hover:bg-red-800'
                                : 'bg-[var(--color-ink)] hover:bg-[var(--color-ink)]'
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

// Blank means "no effect on sweeteners"; otherwise a 0-5 multiplier (0 none, 0.5 half, 1 normal)
export function toSweetenerFactor(raw) {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.min(5, Math.max(0, Math.round(n * 1000) / 1000))
}

export default function OptionGroupList() {
    const [groups, setGroups] = useState([])
    const [linkedCounts, setLinkedCounts] = useState({})
    // choice_id -> option_choice_ingredients rows (null = table not installed)
    const [choiceIngredients, setChoiceIngredients] = useState(null)
    const [ingredientItems, setIngredientItems] = useState(new Map())
    const [ingredientTarget, setIngredientTarget] = useState(null)
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
            const [groupRes, linkRes, ingRes] = await Promise.all([
                supabase
                    .from('option_groups')
                    .select(`*, option_choices (*)`)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('menu_item_options')
                    .select('option_group_id'),
                supabase
                    .from('option_choice_ingredients')
                    .select('id, choice_id, menu_item_id, stock_item_id, quantity, stock_items (id, name, unit, usage_unit)')
            ])

            if (groupRes.error) throw groupRes.error

            const counts = {}
            if (linkRes.data) {
                linkRes.data.forEach(link => {
                    counts[link.option_group_id] = (counts[link.option_group_id] || 0) + 1
                })
            }
            setLinkedCounts(counts)

            if (ingRes.error) {
                setChoiceIngredients(null)
            } else {
                const byChoice = {}
                const items = new Map()
                ;(ingRes.data || []).forEach(row => {
                    ;(byChoice[row.choice_id] ||= []).push(row)
                    if (row.stock_items) items.set(row.stock_item_id, row.stock_items)
                })
                setChoiceIngredients(byChoice)
                setIngredientItems(items)
            }
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
            { id: `temp_${Date.now()}_1`, name: 'หวานปกติ (100%)', price_modifier: 0, sweetener_factor: 1, is_available: true, display_order: 0 },
            { id: `temp_${Date.now()}_2`, name: 'หวานน้อย (50%)', price_modifier: 0, sweetener_factor: 0.5, is_available: true, display_order: 1 },
            { id: `temp_${Date.now()}_3`, name: 'ไม่หวาน (0%)', price_modifier: 0, sweetener_factor: 0, is_available: true, display_order: 2 }
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
                        sweetener_factor: toSweetenerFactor(c.sweetener_factor),
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
                                sweetener_factor: toSweetenerFactor(c.sweetener_factor),
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

    // Sweetness controls appear for a sweetness group, or wherever a multiplier is already set
    const showSweetness = /หวาน|sweet/i.test(formData.name || '') || choices.some(c => c.sweetener_factor !== null && c.sweetener_factor !== undefined && c.sweetener_factor !== '')

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
        <div className="text-[var(--color-ink)] pb-12 animate-fade-in font-sans">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <p className="text-[13px] leading-5 text-[var(--color-muted)] min-w-0">
                    <span className="text-[var(--color-ink)] font-medium tabular-nums">{groups.length} กลุ่มตัวเลือก</span>
                    <span> · กำหนดตัวเลือกเสริม (ความหวาน, ประเภทนม, ท็อปปิ้ง, ระดับความสุก) และราคาบวกเพิ่ม</span>
                    
                </p>

                <button 
                    onClick={handleCreate} 
                    className="admin-btn is-primary h-9"
                >
                    <Plus size={15} /> สร้างกลุ่มตัวเลือก
                </button>
            </div>

            {/* Groups List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-[var(--color-paper-2)] rounded-sm border border-[var(--color-rule)]" />
                    ))}
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[var(--color-rule)] rounded-sm bg-[var(--color-paper)] text-[var(--color-neutral)] tabular-nums text-xs">
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
                                className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm overflow-hidden transition-colors duration-150 hover:border-[var(--brand-plum)]"
                            >
                                <div
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--color-paper)] transition-colors duration-150"
                                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-8 h-8 rounded-xs bg-[var(--color-paper-2)] flex items-center justify-center text-[var(--color-neutral)] border border-[var(--color-rule)] shrink-0">
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-base text-[var(--color-ink)] truncate">
                                                    {group.name}
                                                </h3>
                                                {group.is_required && (
                                                    <span className="tabular-nums text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded-xs">
                                                        บังคับเลือก
                                                    </span>
                                                )}
                                                <span className="tabular-nums text-[11px] bg-[var(--color-paper-2)] text-[var(--color-muted)] border border-[var(--color-rule)] px-1.5 py-0.2 rounded-xs">
                                                    {group.selection_type === 'single' ? 'เลือก 1 อย่าง' : (group.max_selection > 0 ? `เลือกได้สูงสุด ${group.max_selection} อย่าง` : 'เลือกไม่จำกัด')}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-[var(--color-neutral)] mt-1 tabular-nums">
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
                                            className="p-1.5 text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-xs transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                            title="แก้ไขกลุ่มตัวเลือก"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(group)} 
                                            className="p-1.5 text-[var(--color-neutral)] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
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
                                            className="border-t border-[var(--color-rule)] bg-[var(--color-paper)] p-4"
                                        >
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                                {choicesList.map(c => {
                                                    const ingRows = choiceIngredients?.[c.id] || []
                                                    const ingSummary = summarizeChoiceIngredients(ingRows, ingredientItems)
                                                    return (
                                                    <div 
                                                        key={c.id} 
                                                        className={`rounded-xs border text-xs transition-colors duration-150 ${
                                                            c.is_available === false 
                                                                ? 'bg-[var(--color-paper-2)] border-[var(--color-paper-3)] text-[var(--color-neutral)] opacity-70' 
                                                                : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink)]'
                                                        }`}
                                                    >
                                                        <div className="p-2.5 flex justify-between items-center">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="font-bold truncate leading-normal">{c.name}</span>
                                                            {c.is_available === false && (
                                                                <span className="tabular-nums text-[11px] text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded-xs">
                                                                    หมด
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className=" font-bold text-[var(--brand-plum)] shrink-0 ml-2 tabular-nums">
                                                            {c.price_modifier > 0 ? `+฿${c.price_modifier}` : 'ฟรี'}
                                                            {c.sweetener_factor !== null && c.sweetener_factor !== undefined && (
                                                                <span className="ml-2 font-normal text-xs text-[var(--color-muted)]">หวาน ×{Number(c.sweetener_factor)}</span>
                                                            )}
                                                        </span>
                                                        </div>
                                                        {choiceIngredients && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setIngredientTarget({ choice: c, group })}
                                                                className="w-full border-t border-[var(--color-paper-3)] px-2.5 py-2 flex items-baseline justify-between gap-2 text-left hover:bg-[var(--color-paper-2)] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                                            >
                                                                <span className={`min-w-0 truncate leading-normal ${ingSummary ? 'text-[var(--color-muted)]' : 'text-[var(--color-neutral)]'}`}>
                                                                    {ingSummary || 'ไม่ตัดสต๊อกเพิ่ม'}
                                                                </span>
                                                                <span className="tabular-nums text-xs text-[var(--color-muted)] shrink-0">วัตถุดิบ</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    )
                                                })}
                                                {choicesList.length === 0 && (
                                                    <p className="text-[13px] tabular-nums text-[var(--color-neutral)] italic col-span-full py-2">
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
                    <div className="bg-[var(--color-paper)] w-full max-w-lg rounded-sm border border-[var(--color-rule)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-[var(--color-rule)] flex items-center justify-between bg-[var(--color-paper)] z-10">
                            <div>
                                <h3 className="tabular-nums text-base font-bold tracking-tight text-[var(--color-ink)]">
                                    {editingGroup ? 'แก้ไขกลุ่มตัวเลือก' : 'สร้างกลุ่มตัวเลือกใหม่'}
                                </h3>
                                <p className="text-[13px] text-[var(--color-neutral)] tabular-nums mt-0.5">
                                    กำหนดเงื่อนไขการเลือกและรายการตัวเลือกย่อย
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-xs cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body: Planar Form Sections */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-[var(--color-paper)]">
                            {/* Group Name Input */}
                            <div className="pb-4 border-b border-[var(--color-rule)]">
                                <label className="block text-xs tabular-nums font-bold text-[var(--color-muted)] mb-1.5">
                                    ชื่อกลุ่มตัวเลือก (Group Name) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs p-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--brand-plum)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] transition-colors duration-150"
                                    placeholder="เช่น ระดับความหวาน, ประเภทนม, เมล็ดกาแฟ, ท็อปปิ้ง"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Required Toggle (Planar Row) */}
                            <label className="flex items-center justify-between bg-[var(--color-paper)] p-3 rounded-xs border border-[var(--color-rule)] cursor-pointer hover:bg-[var(--color-paper-2)] transition-colors duration-150">
                                <div className="space-y-0.5">
                                    <div className="tabular-nums text-xs font-bold text-[var(--color-ink)]">
                                        ลูกค้าจำเป็นต้องเลือก? (Required)
                                    </div>
                                    <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">
                                        หากเปิดไว้ ลูกค้าจะต้องเลือกอย่างน้อย 1 ตัวเลือกก่อนสั่งเมนูนี้ได้
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={formData.is_required}
                                    onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                                    className="w-4 h-4 accent-[var(--brand-plum)] cursor-pointer"
                                />
                            </label>

                            {/* Selection Rules (Planar Segmented Picker) */}
                            <div className="space-y-2 pb-4 border-b border-[var(--color-rule)]">
                                <label className="text-xs tabular-nums font-bold text-[var(--color-muted)] block">
                                    จำนวนตัวเลือกที่เลือกได้ (Selection Rule)
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* Single */}
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xs border cursor-pointer transition-colors duration-150 ${
                                        limitMode === '1' ? 'bg-[var(--color-paper-2)] border-[var(--brand-plum)] font-bold' : 'bg-[var(--color-paper)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                    }`}>
                                        <input type="radio" checked={limitMode === '1'} onChange={() => setLimitMode('1')} className="accent-[var(--brand-plum)]" />
                                        <span className="text-xs tabular-nums text-[var(--color-ink)]">1 ตัวเลือก</span>
                                    </label>

                                    {/* Multiple Limited */}
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xs border cursor-pointer transition-colors duration-150 ${
                                        limitMode === 'limit' ? 'bg-[var(--color-paper-2)] border-[var(--brand-plum)] font-bold' : 'bg-[var(--color-paper)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                    }`}>
                                        <input type="radio" checked={limitMode === 'limit'} onChange={() => setLimitMode('limit')} className="accent-[var(--brand-plum)]" />
                                        <span className="text-xs tabular-nums text-[var(--color-ink)]">หลายตัวเลือก (จำกัด)</span>
                                    </label>

                                    {/* Unlimited */}
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xs border cursor-pointer transition-colors duration-150 ${
                                        limitMode === 'unlimited' ? 'bg-[var(--color-paper-2)] border-[var(--brand-plum)] font-bold' : 'bg-[var(--color-paper)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                    }`}>
                                        <input type="radio" checked={limitMode === 'unlimited'} onChange={() => setLimitMode('unlimited')} className="accent-[var(--brand-plum)]" />
                                        <span className="text-xs tabular-nums text-[var(--color-ink)]">ไม่จำกัด</span>
                                    </label>
                                </div>

                                {limitMode === 'limit' && (
                                    <div className="flex items-center gap-3 p-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs mt-2">
                                        <span className="text-xs tabular-nums text-[var(--color-muted)]">เลือกได้สูงสุดไม่เกิน:</span>
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, max_selection: Math.max(2, (parseInt(p.max_selection, 10) || 2) - 1) }))}
                                                className="w-9 h-9 bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums font-bold text-sm hover:bg-[var(--color-paper-3)] rounded-xs cursor-pointer flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                            >-</button>
                                            <span className="w-8 text-center font-bold text-sm tabular-nums">{formData.max_selection || 2}</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, max_selection: (parseInt(p.max_selection, 10) || 2) + 1 }))}
                                                className="w-9 h-9 bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums font-bold text-sm hover:bg-[var(--color-paper-3)] rounded-xs cursor-pointer flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                            >+</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Choices Editor */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="text-xs tabular-nums font-bold text-[var(--color-muted)] block">
                                            รายการตัวเลือกย่อย (Choices List)
                                        </label>
                                        <span className="text-xs text-[var(--color-neutral)] tabular-nums">
                                            ใส่ราคา 0 หากไม่คิดเงินเพิ่ม
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addChoice}
                                        className="text-xs tabular-nums font-bold text-[var(--brand-plum)] hover:underline flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                    >
                                        <Plus size={14} /> เพิ่มตัวเลือก
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {choices.map((choice, idx) => (
                                        <div 
                                            key={choice.id || idx} 
                                            className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs p-2 flex items-center gap-2 "
                                        >
                                            {/* Reorder Buttons */}
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => moveChoice(idx, -1)}
                                                    disabled={idx === 0}
                                                    className="text-[var(--color-neutral)] hover:text-[var(--color-ink)] disabled:opacity-20 p-1 rounded-xs hover:bg-[var(--color-paper-2)] cursor-pointer"
                                                    title="เลื่อนขึ้น"
                                                >
                                                    <ArrowUp size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveChoice(idx, 1)}
                                                    disabled={idx === choices.length - 1}
                                                    className="text-[var(--color-neutral)] hover:text-[var(--color-ink)] disabled:opacity-20 p-1 rounded-xs hover:bg-[var(--color-paper-2)] cursor-pointer"
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
                                                className="flex-1 min-w-0 text-sm text-[var(--color-ink)] outline-none bg-transparent placeholder-[var(--color-neutral)] border-b border-transparent focus:border-[var(--brand-plum)] py-1"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        addChoice()
                                                    }
                                                }}
                                            />

                                            {/* Price Modifier */}
                                            <div className="flex items-center gap-1 shrink-0 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xs px-2 py-1">
                                                <span className="text-xs tabular-nums text-[var(--color-neutral)] whitespace-nowrap">+฿</span>
                                                <input
                                                    type="number"
                                                    value={choice.price_modifier}
                                                    onChange={e => updateChoice(idx, 'price_modifier', e.target.value)}
                                                    className="w-12 bg-transparent text-sm outline-none text-right tabular-nums"
                                                    placeholder="0"
                                                />
                                            </div>

                                            {/* Sweetness multiplier: scales sweetener ingredients in stock (blank = no effect) */}
                                            {showSweetness && (
                                                <label
                                                    className="flex items-center gap-1 shrink-0 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xs px-2 py-1"
                                                    title="ตัวคูณสารให้ความหวานในการตัดสต๊อก เช่น ไม่หวาน 0, หวานน้อย 0.5, ปกติ 1, หวานมาก 1.2 · เว้นว่าง = ไม่ปรับ"
                                                >
                                                    <span className="text-xs text-[var(--color-neutral)] whitespace-nowrap">หวาน ×</span>
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        step="0.1"
                                                        min="0"
                                                        max="5"
                                                        value={choice.sweetener_factor ?? ''}
                                                        onChange={e => updateChoice(idx, 'sweetener_factor', e.target.value)}
                                                        className="w-12 bg-transparent text-sm outline-none text-right tabular-nums"
                                                        placeholder="–"
                                                    />
                                                </label>
                                            )}

                                            {/* In Stock Toggle */}
                                            <button
                                                type="button"
                                                onClick={() => updateChoice(idx, 'is_available', choice.is_available === false ? true : false)}
                                                className={`px-2 py-1 rounded-xs border text-xs tabular-nums font-bold transition-colors duration-150 cursor-pointer ${
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
                                                className="p-1.5 text-[var(--color-neutral)] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors duration-150 cursor-pointer"
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
                        <div className="p-4 border-t border-[var(--color-rule)] bg-[var(--color-paper)] flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="admin-btn h-9 flex-1"
                            >
                                ยกเลิก
                            </button>
                            <button 
                                type="button"
                                onClick={handleSubmit} 
                                className="admin-btn is-primary h-9 flex-1"
                            >
                                บันทึกกลุ่มตัวเลือก
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Reusable Confirm Dialog */}
            {ingredientTarget && (
                <ChoiceIngredientsModal
                    choice={ingredientTarget.choice}
                    group={ingredientTarget.group}
                    onClose={() => setIngredientTarget(null)}
                    onSaved={() => fetchGroups()}
                />
            )}

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
