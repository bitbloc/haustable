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
        else if (group.max_selection === 0) mode = 'unlimited' // Assuming 0 is unlimited

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
            is_required: true, // Default to required as per commonly used
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
                // If required, min is 1, else 0
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

            // 2. Sync Choices
            // Get existing IDs
            const currentChoiceIds = choices
                .filter(c => c.id && !c.id.toString().startsWith('temp_')) // Filter out temp IDs
                .map(c => c.id)

            if (groupId) {
                // Delete removed choices
                await supabase.from('option_choices').delete().eq('group_id', groupId).not('id', 'in', `(${currentChoiceIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)

                // Upsert
                const choicesPayload = choices.map((c, idx) => ({
                    // Important: Send undefined for new items (temp IDs) so Supabase generates UUID
                    id: (c.id && !c.id.toString().startsWith('temp_')) ? c.id : undefined,
                    group_id: groupId,
                    name: c.name,
                    price_modifier: parseFloat(c.price_modifier || 0),
                    is_available: c.is_available !== false,
                    display_order: idx
                }))

                if (choicesPayload.length > 0) {
                    const { error: choicesError } = await supabase.from('option_choices').upsert(choicesPayload)
                    if (choicesError) throw choicesError
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
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Option Groups</h2>
                <button onClick={handleCreate} className="bg-[#FF5A1F] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#e04f1b]">
                    <Plus size={18} /> สร้างกลุ่มตัวเลือก
                </button>
            </div>

            <div className="space-y-4">
                {groups.map(group => (
                    <div key={group.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
                        <div
                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/5"
                            onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`p-1 rounded ${expandedGroup === group.id ? 'bg-white/10' : ''}`}>
                                    {expandedGroup === group.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </span>
                                <div>
                                    <h3 className="font-bold text-lg">{group.name}</h3>
                                    <p className="text-xs text-gray-500">
                                        {group.selection_type === 'single' ? 'เลือก 1 อย่าง' : 'เลือกได้หลายอย่าง'} • {group.is_required ? 'บังคับเลือก' : 'ไม่บังคับ'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-400">{group.option_choices?.length} ตัวเลือก</span>
                                <button onClick={(e) => { e.stopPropagation(); handleEdit(group) }} className="p-2 hover:text-[#FF5A1F]"><Edit2 size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(group.id) }} className="p-2 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        {/* Expanded Choices View */}
                        <AnimatePresence>
                            {expandedGroup === group.id && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden bg-[#111] border-t border-white/5"
                                >
                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {group.option_choices?.sort((a, b) => a.display_order - b.display_order).map(c => (
                                            <div key={c.id} className="flex justify-between p-2 bg-white/5 rounded text-sm">
                                                <span>{c.name}</span>
                                                <span className="text-gray-400">+{c.price_modifier}</span>
                                            </div>
                                        ))}
                                        {group.option_choices?.length === 0 && <p className="text-gray-500 text-sm italic p-2">ยังไม่มีตัวเลือก</p>}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                            <button onClick={() => setIsModalOpen(false)}><ChevronDown className="rotate-90 text-gray-400" /></button>
                            <h2 className="text-lg font-bold flex-1 text-center">{editingGroup ? 'แก้ไขกลุ่มตัวเลือก' : 'สร้างกลุ่มตัวเลือก'}</h2>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-gray-50/50">
                            {/* Group Name Input */}
                            <div>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-4 text-base outline-none focus:border-[#FF5A1F] transition-all shadow-sm"
                                    placeholder="ชื่อกลุ่มตัวเลือก option (เช่น ระดับความหวาน)"
                                />
                            </div>

                            {/* Required Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-base font-medium">ลูกค้าจำเป็นต้องเลือก</span>
                                <button
                                    onClick={() => setFormData({ ...formData, is_required: !formData.is_required })}
                                    className={`w-14 h-8 rounded-full p-1 transition-colors relative ${formData.is_required ? 'bg-[#FF5A1F]' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${formData.is_required ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Selection Rules */}
                            <div className="space-y-3">
                                <label className="text-base font-bold text-black">จำนวนตัวเลือกที่เลือกได้</label>

                                <div className="space-y-3">
                                    {/* Option 1: Single */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === '1' ? 'border-[#FF5A1F]' : 'border-gray-300'}`}>
                                            {limitMode === '1' && <div className="w-2.5 h-2.5 bg-[#FF5A1F] rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === '1'} onChange={() => setLimitMode('1')} className="hidden" />
                                        <span className="text-gray-700">1 ตัวเลือก</span>
                                    </label>

                                    {/* Option 2: Limit Range */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === 'limit' ? 'border-[#FF5A1F]' : 'border-gray-300'}`}>
                                            {limitMode === 'limit' && <div className="w-2.5 h-2.5 bg-[#FF5A1F] rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === 'limit'} onChange={() => setLimitMode('limit')} className="hidden" />
                                        <span className="text-gray-700">มากกว่า 1 แต่ไม่เกิน</span>
                                        <div className="flex items-center gap-2 bg-gray-100 rounded px-2">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, max_selection: Math.max(2, (parseInt(p.max_selection) || 2) - 1) })) }}
                                                className="w-6 h-8 text-gray-500 hover:text-black font-bold"
                                                disabled={limitMode !== 'limit'}
                                            >-</button>
                                            <span className="w-4 text-center text-sm font-bold">{formData.max_selection || 2}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, max_selection: (parseInt(p.max_selection) || 2) + 1 })) }}
                                                className="w-6 h-8 text-gray-500 hover:text-black font-bold"
                                                disabled={limitMode !== 'limit'}
                                            >+</button>
                                        </div>
                                    </label>

                                    {/* Option 3: Unlimited */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === 'unlimited' ? 'border-[#FF5A1F]' : 'border-gray-300'}`}>
                                            {limitMode === 'unlimited' && <div className="w-2.5 h-2.5 bg-[#FF5A1F] rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === 'unlimited'} onChange={() => setLimitMode('unlimited')} className="hidden" />
                                        <span className="text-gray-700">ไม่จำกัด</span>
                                    </label>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Choices Editor */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-base font-bold text-black">ตัวเลือก</label>
                                    <button type="button" className="text-[#FF5A1F] text-xs font-bold flex items-center gap-1 hover:underline">
                                        <Edit2 size={12} /> แก้ไขลำดับ
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {choices.map((choice, idx) => (
                                        <div key={choice.id || idx} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                                            <div className="flex-1 space-y-1">
                                                <input
                                                    type="text"
                                                    value={choice.name}
                                                    onChange={e => updateChoice(idx, 'name', e.target.value)}
                                                    placeholder="ชื่อตัวเลือก (เช่น หวานน้อย)"
                                                    className="w-full text-sm font-medium outline-none bg-transparent placeholder-gray-400"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">฿</span>
                                                    <input
                                                        type="number"
                                                        value={choice.price_modifier}
                                                        onChange={e => updateChoice(idx, 'price_modifier', e.target.value)}
                                                        className="w-20 bg-transparent border-none text-xs text-gray-500 outline-none"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <button onClick={() => removeChoice(idx)} className="p-2 text-gray-300 hover:text-red-500">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addChoice}
                                    className="w-full mt-4 bg-[#FFEFEC] text-[#FF5A1F] font-bold py-3 rounded-xl hover:bg-[#ffe5df] transition-colors flex justify-center items-center gap-2"
                                >
                                    <Plus size={18} /> เพิ่มตัวเลือก
                                </button>
                            </div>

                            {/* Delete Button (Only edit mode) */}
                            {editingGroup && (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(editingGroup.id)}
                                    className="w-full bg-gray-100 text-gray-500 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex justify-center items-center gap-2"
                                >
                                    <Trash2 size={18} /> ลบกลุ่มตัวเลือก
                                </button>
                            )}
                        </div>

                        {/* Footer (Save) */}
                        <div className="p-4 bg-white border-t border-gray-100">
                            <button onClick={handleSubmit} className="w-full bg-[#FF5A1F] text-white font-bold py-3 rounded-xl hover:bg-[#e04f1b] shadow-lg shadow-orange-200 transition-all">
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
