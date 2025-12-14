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
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Option Groups</h2>
                <button onClick={handleCreate} className="bg-[#DFFF00] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#b0cc00]">
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
                                <button onClick={(e) => { e.stopPropagation(); handleEdit(group) }} className="p-2 hover:text-[#DFFF00]"><Edit2 size={16} /></button>
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
                    <div className="bg-[#1a1a1a] w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] text-white">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editingGroup ? 'แก้ไขกลุ่มตัวเลือก' : 'สร้างกลุ่มตัวเลือก'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-gray-500 hover:text-white" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Group Name Input */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">ชื่อกลุ่มตัวเลือก option (เช่น ระดับความหวาน)</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black border border-white/20 rounded-xl p-4 text-white outline-none focus:border-[#DFFF00] transition-colors"
                                    placeholder="เช่น ระดับความหวาน"
                                />
                            </div>

                            {/* Required Toggle */}
                            <div className="flex items-center justify-between bg-black/50 p-4 rounded-xl border border-white/5">
                                <span className="text-sm font-medium">ลูกค้าจำเป็นต้องเลือก?</span>
                                <button
                                    onClick={() => setFormData({ ...formData, is_required: !formData.is_required })}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors relative ${formData.is_required ? 'bg-[#DFFF00]' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-black rounded-full shadow-md transition-transform ${formData.is_required ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Selection Rules */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-gray-400 uppercase">จำนวนตัวเลือกที่เลือกได้</label>

                                <div className="space-y-3">
                                    {/* Option 1: Single */}
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === '1' ? 'border-[#DFFF00]' : 'border-gray-500'}`}>
                                            {limitMode === '1' && <div className="w-2.5 h-2.5 bg-[#DFFF00] rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === '1'} onChange={() => setLimitMode('1')} className="hidden" />
                                        <span className="text-gray-200">1 ตัวเลือก</span>
                                    </label>

                                    {/* Option 2: Limit Range */}
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === 'limit' ? 'border-[#DFFF00]' : 'border-gray-500'}`}>
                                            {limitMode === 'limit' && <div className="w-2.5 h-2.5 bg-[#DFFF00] rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === 'limit'} onChange={() => setLimitMode('limit')} className="hidden" />
                                        <span className="text-gray-200">มากกว่า 1 แต่ไม่เกิน</span>
                                        <div className="flex items-center gap-2 bg-black rounded px-2 border border-white/20">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, max_selection: Math.max(2, (parseInt(p.max_selection) || 2) - 1) })) }}
                                                className="w-6 h-8 text-gray-500 hover:text-white font-bold"
                                                disabled={limitMode !== 'limit'}
                                            >-</button>
                                            <span className="w-6 text-center text-sm font-bold text-white">{formData.max_selection || 2}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, max_selection: (parseInt(p.max_selection) || 2) + 1 })) }}
                                                className="w-6 h-8 text-gray-500 hover:text-white font-bold"
                                                disabled={limitMode !== 'limit'}
                                            >+</button>
                                        </div>
                                    </label>

                                    {/* Option 3: Unlimited */}
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${limitMode === 'unlimited' ? 'border-[#DFFF00]' : 'border-gray-500'}`}>
                                            {limitMode === 'unlimited' && <div className="w-2.5 h-2.5 bg-[#DFFF00] rounded-full" />}
                                        </div>
                                        <input type="radio" checked={limitMode === 'unlimited'} onChange={() => setLimitMode('unlimited')} className="hidden" />
                                        <span className="text-gray-200">ไม่จำกัด</span>
                                    </label>
                                </div>
                            </div>

                            <hr className="border-white/10" />

                            {/* Choices Editor */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase">ตัวเลือก</label>
                                    <div className="text-xs text-gray-500">
                                        ราคา 0 = ไม่คิดเงินเพิ่ม
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {choices.map((choice, idx) => (
                                        <div key={choice.id || idx} className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                                            <div className="flex-1 space-y-1">
                                                <input
                                                    type="text"
                                                    value={choice.name}
                                                    onChange={e => updateChoice(idx, 'name', e.target.value)}
                                                    placeholder="ชื่อตัวเลือก (เช่น หวานน้อย)"
                                                    className="w-full text-sm font-medium outline-none bg-transparent placeholder-gray-600 text-white"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-[#DFFF00]">+</span>
                                                    <input
                                                        type="number"
                                                        value={choice.price_modifier}
                                                        onChange={e => updateChoice(idx, 'price_modifier', e.target.value)}
                                                        className="w-20 bg-transparent border-none text-xs text-gray-400 outline-none focus:text-[#DFFF00]"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <button onClick={() => removeChoice(idx)} className="p-2 text-gray-600 hover:text-red-500">
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addChoice}
                                    className="w-full mt-4 bg-white/5 text-[#DFFF00] font-bold py-3 rounded-xl hover:bg-white/10 transition-colors flex justify-center items-center gap-2 border border-[#DFFF00]/20"
                                >
                                    <Plus size={18} /> เพิ่มตัวเลือก
                                </button>
                            </div>
                        </div>

                        {/* Footer (Save) */}
                        <div className="p-6 border-t border-white/10 bg-[#111]">
                            <button onClick={handleSubmit} className="w-full bg-[#DFFF00] text-black font-bold py-3 rounded-xl hover:bg-[#cce600] transition-colors">
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
