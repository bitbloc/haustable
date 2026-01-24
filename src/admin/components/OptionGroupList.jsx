import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function OptionGroupList() {
    const [groups, setGroups] = useState([])
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

    // Selection Limit Mode: '1', 'limit', 'unlimited'
    const [limitMode, setLimitMode] = useState('1')

    // Choices for the current group being edited
    const [choices, setChoices] = useState([])

    useEffect(() => {
        fetchGroups()
    }, [])

    const fetchGroups = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('option_groups')
            .select(`
                *,
                option_choices (*)
            `)
            .order('created_at', { ascending: false })

        if (error) console.error(error)
        else setGroups(data || [])
        setLoading(false)
    }

    const handleEdit = (group) => {
        setEditingGroup(group)

        // Determine Limit Mode
        let mode = '1'
        if (group.max_selection === 1) mode = '1'
        else if (group.max_selection > 1) mode = 'limit'
        else if (group.max_selection === 0) mode = 'unlimited'

        setLimitMode(mode)

        setFormData({
            name: group.name,
            is_required: group.is_required,
            selection_type: group.selection_type,
            min_selection: group.min_selection,
            max_selection: group.max_selection
        })
        setChoices(group.option_choices || [])
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
        setChoices([])
        setIsModalOpen(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('ยืนยันการลบกลุ่มตัวเลือกนี้? (Are you sure?)')) return
        const { error } = await supabase.from('option_groups').delete().eq('id', id)
        if (!error) fetchGroups()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            let groupId = editingGroup?.id

            // Logic to determine backend values based on Limit Mode
            let finalMin = 0
            let finalMax = 1
            let finalType = 'single'

            if (limitMode === '1') {
                finalMax = 1
                finalType = 'single'
                finalMin = formData.is_required ? 1 : 0
            } else if (limitMode === 'limit') {
                finalMax = parseInt(formData.max_selection) || 2
                finalType = 'multiple'
                finalMin = formData.is_required ? 1 : 0
            } else if (limitMode === 'unlimited') {
                finalMax = 0 // 0 = unlimited
                finalType = 'multiple'
                finalMin = formData.is_required ? 1 : 0
            }

            // 1. Upsert Group
            const payload = {
                name: formData.name,
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

            // 2. Sync Choices (Split Insert/Update to avoid NULL ID error)
            const currentChoiceIds = choices
                .filter(c => c.id && !c.id.toString().startsWith('temp_'))
                .map(c => c.id)

            if (groupId) {
                // 2.1 Delete removed choices
                await supabase.from('option_choices').delete().eq('group_id', groupId).not('id', 'in', `(${currentChoiceIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)

                // 2.2 Separate New vs Existing
                const newChoices = choices.filter(c => !c.id || c.id.toString().startsWith('temp_'))
                const existingChoices = choices.filter(c => c.id && !c.id.toString().startsWith('temp_'))

                // 2.3 Insert New
                if (newChoices.length > 0) {
                    const insertPayload = newChoices.map((c, idx) => ({
                        group_id: groupId,
                        name: c.name,
                        price_modifier: parseFloat(c.price_modifier || 0),
                        is_available: c.is_available !== false,
                        display_order: idx + existingChoices.length // Append order roughly
                    }))
                    const { error: insertError } = await supabase.from('option_choices').insert(insertPayload)
                    if (insertError) throw insertError
                }

                // 2.4 Update Existing
                // Upsert works fine here because we HAVE the ID
                if (existingChoices.length > 0) {
                    const updatePayload = existingChoices.map((c, idx) => ({
                        id: c.id,
                        group_id: groupId,
                        name: c.name,
                        price_modifier: parseFloat(c.price_modifier || 0),
                        is_available: c.is_available !== false,
                        display_order: idx // Might conflict with new ones if not careful, but okay for now
                    }))
                    const { error: updateError } = await supabase.from('option_choices').upsert(updatePayload)
                    if (updateError) throw updateError
                }
            }

            setIsModalOpen(false)
            fetchGroups()

        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // --- Choice Handlers in Modal ---
    const addChoice = () => {
        setChoices([...choices, { id: `temp_${Date.now()}`, name: '', price_modifier: 0, is_available: true }])
    }
    const updateChoice = (index, field, value) => {
        const newChoices = [...choices]
        newChoices[index][field] = value
        setChoices(newChoices)
    }
    const removeChoice = (index) => {
        setChoices(choices.filter((_, i) => i !== index))
    }


    return (
        <div className="text-ink pb-20 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-ink">Option Groups</h2>
                <button onClick={handleCreate} className="bg-brand text-ink px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brandDark border border-brandDark/10 shadow-sm transition-colors">
                    <Plus size={18} /> สร้างกลุ่มตัวเลือก
                </button>
            </div>

            <div className="space-y-4">
                {groups.map(group => (
                    <div key={group.id} className="bg-paper border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                        <div
                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`p-1 rounded ${expandedGroup === group.id ? 'bg-gray-100' : ''}`}>
                                    {expandedGroup === group.id ? <ChevronUp size={20} className="text-subInk" /> : <ChevronDown size={20} className="text-subInk" />}
                                </span>
                                <div>
                                    <h3 className="font-bold text-lg text-ink">{group.name}</h3>
                                    <p className="text-xs text-subInk">
                                        {group.selection_type === 'single' ? 'เลือก 1 อย่าง' : 'เลือกได้หลายอย่าง'} • {group.is_required ? 'บังคับเลือก' : 'ไม่บังคับ'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-subInk border border-gray-200">{group.option_choices?.length} ตัวเลือก</span>
                                <button onClick={(e) => { e.stopPropagation(); handleEdit(group) }} className="p-2 text-subInk hover:text-brandDark bg-transparent hover:bg-brand/10 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(group.id) }} className="p-2 text-subInk hover:text-red-500 bg-transparent hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        {/* Expanded Choices View */}
                        <AnimatePresence>
                            {expandedGroup === group.id && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden bg-canvas border-t border-gray-200"
                                >
                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {group.option_choices?.sort((a, b) => a.display_order - b.display_order).map(c => (
                                            <div key={c.id} className="flex justify-between p-3 bg-white border border-gray-100 shadow-sm rounded-lg text-sm group hover:border-brand/30 transition-colors">
                                                <span className="font-medium text-ink">{c.name}</span>
                                                <span className="text-subInk font-mono">+{c.price_modifier}</span>
                                            </div>
                                        ))}
                                        {group.option_choices?.length === 0 && <p className="text-subInk text-sm italic p-2">ยังไม่มีตัวเลือก</p>}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-paper w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] text-ink">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-paper z-10">
                            <h2 className="text-lg font-bold text-ink">{editingGroup ? 'แก้ไขกลุ่มตัวเลือก' : 'สร้างกลุ่มตัวเลือก'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-subInk hover:text-ink" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-canvas">
                            {/* Group Name Input */}
                            <div>
                                <label className="block text-xs font-bold text-subInk mb-2">ชื่อกลุ่มตัวเลือก option (เช่น ระดับความหวาน)</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-paper border border-gray-200 rounded-xl p-4 text-ink outline-none focus:border-brand transition-colors shadow-sm"
                                    placeholder="เช่น ระดับความหวาน"
                                />
                            </div>

                            {/* Required Toggle */}
                            <div className="flex items-center justify-between bg-paper p-4 rounded-xl border border-gray-200 shadow-sm">
                                <span className="text-sm font-medium text-ink">ลูกค้าจำเป็นต้องเลือก?</span>
                                <button
                                    onClick={() => setFormData({ ...formData, is_required: !formData.is_required })}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors relative ${formData.is_required ? 'bg-brand' : 'bg-gray-200'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${formData.is_required ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Selection Rules */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-subInk uppercase">จำนวนตัวเลือกที่เลือกได้</label>

                                <div className="space-y-3">
                                    {/* Option 1: Single */}
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 bg-paper hover:border-brand/50 transition-colors shadow-sm">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === '1' ? 'border-brand' : 'border-gray-400'}`}>
                                            {limitMode === '1' && <div className="w-2.5 h-2.5 bg-brand rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === '1'} onChange={() => setLimitMode('1')} className="hidden" />
                                        <span className="text-ink font-medium">1 ตัวเลือก</span>
                                    </label>

                                    {/* Option 2: Limit Range */}
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 bg-paper hover:border-brand/50 transition-colors shadow-sm">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === 'limit' ? 'border-brand' : 'border-gray-400'}`}>
                                            {limitMode === 'limit' && <div className="w-2.5 h-2.5 bg-brand rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === 'limit'} onChange={() => setLimitMode('limit')} className="hidden" />
                                        <span className="text-ink font-medium">มากกว่า 1 แต่ไม่เกิน</span>
                                        <div className="flex items-center gap-2 bg-gray-100 rounded px-2 border border-gray-200 ml-auto">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, max_selection: Math.max(2, (parseInt(p.max_selection) || 2) - 1) })) }}
                                                className="w-6 h-8 text-subInk hover:text-ink font-bold"
                                                disabled={limitMode !== 'limit'}
                                            >-</button>
                                            <span className="w-6 text-center text-sm font-bold text-ink">{formData.max_selection || 2}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, max_selection: (parseInt(p.max_selection) || 2) + 1 })) }}
                                                className="w-6 h-8 text-subInk hover:text-ink font-bold"
                                                disabled={limitMode !== 'limit'}
                                            >+</button>
                                        </div>
                                    </label>

                                    {/* Option 3: Unlimited */}
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 bg-paper hover:border-brand/50 transition-colors shadow-sm">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === 'unlimited' ? 'border-brand' : 'border-gray-400'}`}>
                                            {limitMode === 'unlimited' && <div className="w-2.5 h-2.5 bg-brand rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === 'unlimited'} onChange={() => setLimitMode('unlimited')} className="hidden" />
                                        <span className="text-ink font-medium">ไม่จำกัด</span>
                                    </label>
                                </div>
                            </div>

                            <hr className="border-gray-200" />

                            {/* Choices Editor */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-xs font-bold text-subInk uppercase">ตัวเลือก</label>
                                    <div className="text-xs text-subInk">
                                        ราคา 0 = ไม่คิดเงินเพิ่ม
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {choices.map((choice, idx) => (
                                        <div key={choice.id || idx} className="bg-paper border border-gray-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                                            <div className="flex-1 space-y-1">
                                                <input
                                                    type="text"
                                                    value={choice.name}
                                                    onChange={e => updateChoice(idx, 'name', e.target.value)}
                                                    placeholder="ชื่อตัวเลือก (เช่น หวานน้อย)"
                                                    className="w-full text-sm font-medium outline-none bg-transparent placeholder-gray-400 text-ink"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-brandDark">+</span>
                                                    <input
                                                        type="number"
                                                        value={choice.price_modifier}
                                                        onChange={e => updateChoice(idx, 'price_modifier', e.target.value)}
                                                        className="w-20 bg-transparent border-none text-xs text-subInk outline-none focus:text-ink font-mono"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <button onClick={() => removeChoice(idx)} className="p-2 text-subInk hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addChoice}
                                    className="w-full mt-4 bg-white text-brandDark font-bold py-3 rounded-xl hover:bg-brand/5 transition-colors flex justify-center items-center gap-2 border border-brand/20 shadow-sm"
                                >
                                    <Plus size={18} /> เพิ่มตัวเลือก
                                </button>
                            </div>
                        </div>

                        {/* Footer (Save) */}
                        <div className="p-6 border-t border-gray-200 bg-gray-50">
                            <button onClick={handleSubmit} className="w-full bg-brand text-ink font-bold py-3 rounded-xl hover:bg-brandDark transition-colors shadow-lg shadow-brand/20">
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
