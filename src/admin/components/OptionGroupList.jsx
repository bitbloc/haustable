import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
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
        setFormData({
            name: '',
            is_required: false,
            selection_type: 'single', // or 'multiple'
            min_selection: 0,
            max_selection: 1
        })
        setChoices([])
        setIsModalOpen(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this option group?')) return
        const { error } = await supabase.from('option_groups').delete().eq('id', id)
        if (!error) fetchGroups()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            let groupId = editingGroup?.id

            // 1. Upsert Group
            const payload = {
                name: formData.name,
                is_required: formData.is_required,
                selection_type: formData.selection_type,
                min_selection: parseInt(formData.min_selection),
                max_selection: parseInt(formData.max_selection)
            }

            if (editingGroup) {
                const { error } = await supabase.from('option_groups').update(payload).eq('id', groupId)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('option_groups').insert(payload).select().single()
                if (error) throw error
                groupId = data.id
            }

            // 2. Upsert Choices
            // Strategy: Delete all existing choices for this group and re-insert (easiest for now)
            // Ideally, we should diff/update, but for simplicity:
            if (editingGroup) {
                // Determine which IDs to keep if we want to update vs delete... 
                // Simple approach: Delete all not in current list (if we track IDs), or just delete all.
                // Re-inserting all is safer for order handling if we implement drag-drop later.
                // For now, let's try to update existing ones if they have ID, insert new ones.

                // Better approach for this session:
                // Just handle 'choices' state. 
            }

            // Actually, let's just do a bulk upsert for simplicity 
            // BUT we need to handle deletions. 
            // Let's use a simple approach: 
            // 1. Get existing IDs for this group
            // 2. Identify IDs to delete (not in current choices)
            // 3. Upsert valid choices

            const currentChoiceIds = choices.filter(c => c.id).map(c => c.id)
            if (groupId) {
                // Delete removed choices
                await supabase.from('option_choices').delete().eq('group_id', groupId).not('id', 'in', `(${currentChoiceIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)

                // Upsert
                const choicesPayload = choices.map((c, idx) => ({
                    id: c.id?.length > 10 ? c.id : undefined, // Keep ID if valid, else undefined (insert)
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
                <button onClick={handleCreate} className="bg-[#DFFF00] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#b0cc00]">
                    <Plus size={18} /> New Group
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
                                        {group.selection_type.toUpperCase()} • {group.min_selection}-{group.max_selection} selections • {group.is_required ? 'Required' : 'Optional'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-400">{group.option_choices?.length} choices</span>
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
                                        {group.option_choices?.length === 0 && <p className="text-gray-500 text-sm italic p-2">No choices added yet.</p>}
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
                    <div className="bg-[#1a1a1a] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingGroup ? 'Edit Option Group' : 'New Option Group'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-gray-500 hover:text-white" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Group Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black border border-white/20 rounded-lg p-3 text-white focus:border-[#DFFF00] outline-none"
                                        placeholder="e.g. Sweetness Level, Toppings"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Selection Type</label>
                                    <select
                                        value={formData.selection_type}
                                        onChange={e => setFormData({ ...formData, selection_type: e.target.value })}
                                        className="w-full bg-black border border-white/20 rounded-lg p-3 text-white outline-none"
                                    >
                                        <option value="single">Single Select (Radio)</option>
                                        <option value="multiple">Multiple Select (Checkbox)</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-3 pt-6">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_required}
                                        onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                                        className="w-5 h-5 accent-[#DFFF00]"
                                    />
                                    <span className="text-sm font-bold">Required?</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Min Selection</label>
                                    <input type="number" value={formData.min_selection} onChange={e => setFormData({ ...formData, min_selection: e.target.value })} className="w-full bg-black border border-white/20 rounded-lg p-3 text-white outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Max Selection</label>
                                    <input type="number" value={formData.max_selection} onChange={e => setFormData({ ...formData, max_selection: e.target.value })} className="w-full bg-black border border-white/20 rounded-lg p-3 text-white outline-none" />
                                </div>
                            </div>

                            {/* Choices Editor */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-bold text-gray-400 uppercase">Choices</label>
                                    <button type="button" onClick={addChoice} className="text-[#DFFF00] text-xs font-bold hover:underline">+ Add Choice</button>
                                </div>
                                <div className="space-y-2">
                                    {choices.map((choice, idx) => (
                                        <div key={choice.id || idx} className="flex gap-2 items-center">
                                            <span className="text-gray-600 text-xs w-6 text-center">{idx + 1}</span>
                                            <input
                                                type="text"
                                                value={choice.name}
                                                onChange={e => updateChoice(idx, 'name', e.target.value)}
                                                placeholder="Choice Name"
                                                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white"
                                            />
                                            <div className="flex items-center bg-black/50 border border-white/10 rounded px-2">
                                                <span className="text-gray-500 text-xs">+</span>
                                                <input
                                                    type="number"
                                                    value={choice.price_modifier}
                                                    onChange={e => updateChoice(idx, 'price_modifier', e.target.value)}
                                                    className="w-20 bg-transparent border-none text-sm text-white text-right outline-none py-2"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <button onClick={() => removeChoice(idx)} className="p-2 text-gray-500 hover:text-red-500"><X size={16} /></button>
                                        </div>
                                    ))}
                                    {choices.length === 0 && (
                                        <div className="text-center py-8 border border-dashed border-white/10 rounded-xl text-gray-500 text-sm">
                                            No choices yet. Add one to get started.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 bg-[#111]">
                            <button onClick={handleSubmit} className="w-full bg-[#DFFF00] text-black font-bold py-3 rounded-xl hover:bg-[#cce600] transition-colors">
                                Save Group
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
