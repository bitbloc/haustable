import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Check } from 'lucide-react'

export default function MenuItemList() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [optionGroups, setOptionGroups] = useState([])

    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [imageFile, setImageFile] = useState(null)

    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category_id: '',
        description: '',
        is_available: true,
        is_recommended: false
    })

    const [selectedOptionGroups, setSelectedOptionGroups] = useState([])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const [menuRes, catRes, optRes] = await Promise.all([
            // Fetch Menu Items with linked Options
            supabase.from('menu_items').select(`
                *,
                menu_categories (name),
                menu_item_options (
                    option_group_id,
                    display_order
                )
            `).order('created_at', { ascending: false }),

            // Fetch Categories
            supabase.from('menu_categories').select('*').order('display_order'),

            // Fetch Option Groups
            supabase.from('option_groups').select('*').order('name')
        ])

        if (menuRes.data) setMenuItems(menuRes.data)
        if (catRes.data) setCategories(catRes.data)
        if (optRes.data) setOptionGroups(optRes.data)
        setLoading(false)
    }

    const handleCreate = () => {
        setEditingItem(null)
        setFormData({
            name: '',
            price: '',
            category_id: categories[0]?.id || '',
            description: '',
            is_available: true,
            is_recommended: false
        })
        setSelectedOptionGroups([])
        setImageFile(null)
        setIsModalOpen(true)
    }

    const handleEdit = (item) => {
        setEditingItem(item)
        setFormData({
            name: item.name,
            price: item.price,
            category_id: item.category_id || categories.find(c => c.name === item.category)?.id || '',
            description: item.description || '',
            is_available: item.is_available,
            is_recommended: item.is_recommended
        })
        // Extract linked option groups
        const linkedGroups = item.menu_item_options?.map(o => o.option_group_id) || []
        setSelectedOptionGroups(linkedGroups)

        setImageFile(null)
        setIsModalOpen(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this menu item?')) return
        await supabase.from('menu_items').delete().eq('id', id)
        fetchData()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            let imageUrl = editingItem?.image_url || ''

            if (imageFile) {
                const fileName = `menu_${Date.now()}.${imageFile.name.split('.').pop()}`
                const { error } = await supabase.storage.from('public-assets').upload(fileName, imageFile)
                if (error) throw error
                const { data } = supabase.storage.from('public-assets').getPublicUrl(fileName)
                imageUrl = data.publicUrl
            }

            // Fallback for old schema compatibility (if 'category' column still exists and is used)
            const selectedCatName = categories.find(c => c.id === formData.category_id)?.name || 'Main'

            const payload = {
                name: formData.name,
                price: parseFloat(formData.price),
                category_id: formData.category_id || null,
                category: selectedCatName, // Maintain backward compatibility for now
                description: formData.description,
                is_available: formData.is_available,
                is_recommended: formData.is_recommended,
                image_url: imageUrl
            }

            let newItemId = editingItem?.id

            if (editingItem) {
                const { error } = await supabase.from('menu_items').update(payload).eq('id', newItemId)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('menu_items').insert(payload).select().single()
                if (error) throw error
                newItemId = data.id
            }

            // Sync Option Groups
            // 1. Delete existing links
            if (newItemId) {
                await supabase.from('menu_item_options').delete().eq('menu_item_id', newItemId)

                // 2. Insert new links
                if (selectedOptionGroups.length > 0) {
                    const links = selectedOptionGroups.map((groupId, idx) => ({
                        menu_item_id: newItemId,
                        option_group_id: groupId,
                        display_order: idx
                    }))
                    const { error: linkError } = await supabase.from('menu_item_options').insert(links)
                    if (linkError) throw linkError
                }
            }

            setIsModalOpen(false)
            fetchData()

        } catch (error) {
            alert('Error: ' + error.message)
        }
    }

    const toggleOptionGroup = (groupId) => {
        if (selectedOptionGroups.includes(groupId)) {
            setSelectedOptionGroups(selectedOptionGroups.filter(id => id !== groupId))
        } else {
            setSelectedOptionGroups([...selectedOptionGroups, groupId])
        }
    }

    return (
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold">Menu Items</h2>
                    <p className="text-gray-500 text-sm">Manage items, prices, and options</p>
                </div>
                <button onClick={handleCreate} className="bg-[#DFFF00] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#b0cc00]">
                    <Plus size={18} /> New Item
                </button>
            </div>

            {/* Group by Category */}
            <div className="space-y-8">
                {categories.map(cat => {
                    const items = menuItems.filter(i => i.category_id === cat.id || (!i.category_id && i.category === cat.name))
                    if (items.length === 0) return null

                    return (
                        <div key={cat.id}>
                            <h3 className="text-xl font-bold text-[#DFFF00] mb-4 border-b border-white/10 pb-2 flex items-center gap-2">
                                {cat.name} <span className="text-xs text-gray-500 font-normal">({items.length})</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.map(item => (
                                    <div key={item.id} className="group bg-[#1a1a1a] border border-white/5 rounded-xl p-3 flex gap-4 hover:border-white/20 transition-all">
                                        <div className="w-16 h-16 bg-black rounded-lg overflow-hidden shrink-0">
                                            {item.image_url ? (
                                                <img src={item.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-700"><ImageIcon size={16} /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold truncate">{item.name}</h4>
                                                <span className="text-[#DFFF00] font-mono">{item.price}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 line-clamp-1">{item.description}</div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.is_available ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {item.is_available ? 'Available' : 'Sold Out'}
                                                </span>
                                                {item.is_recommended && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Rec.</span>}
                                                {item.menu_item_options?.length > 0 && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{item.menu_item_options.length} Opts</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(item)} className="p-1 hover:text-[#DFFF00]"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingItem ? 'Edit Item' : 'New Item'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-gray-500 hover:text-white" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left: Basic Info */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 uppercase text-xs mb-4">Basic Information</h3>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Name</label>
                                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-black border border-white/20 rounded-lg p-3 text-white focus:border-[#DFFF00] outline-none" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Price</label>
                                        <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full bg-black border border-white/20 rounded-lg p-3 text-white focus:border-[#DFFF00] outline-none" required />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Category</label>
                                        <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })} className="w-full bg-black border border-white/20 rounded-lg p-3 text-white outline-none">
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Description</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-black border border-white/20 rounded-lg p-3 text-white focus:border-[#DFFF00] outline-none resize-none" rows={3}></textarea>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Image</label>
                                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full bg-black border border-white/20 rounded-lg p-2 text-sm text-gray-400" />
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.is_available} onChange={e => setFormData({ ...formData, is_available: e.target.checked })} className="w-4 h-4 accent-[#DFFF00]" />
                                        <span className="text-sm">Available</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.is_recommended} onChange={e => setFormData({ ...formData, is_recommended: e.target.checked })} className="w-4 h-4 accent-[#DFFF00]" />
                                        <span className="text-sm">Recommended</span>
                                    </label>
                                </div>
                            </div>

                            {/* Right: Option Groups */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 uppercase text-xs mb-4">Option Groups (Add-ons)</h3>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {optionGroups.map(group => {
                                        const isSelected = selectedOptionGroups.includes(group.id)
                                        return (
                                            <div
                                                key={group.id}
                                                onClick={() => toggleOptionGroup(group.id)}
                                                className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${isSelected ? 'bg-[#DFFF00]/10 border-[#DFFF00]' : 'bg-black border-white/10 hover:border-white/30'}`}
                                            >
                                                <div>
                                                    <div className={`font-bold text-sm ${isSelected ? 'text-[#DFFF00]' : 'text-white'}`}>{group.name}</div>
                                                    <div className="text-xs text-gray-500">{group.is_required ? 'Required' : 'Optional'} • {group.selection_type}</div>
                                                </div>
                                                {isSelected && <Check size={16} className="text-[#DFFF00]" />}
                                            </div>
                                        )
                                    })}
                                    {optionGroups.length === 0 && <p className="text-gray-500 text-sm">No option groups created yet.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10">
                            <button onClick={handleSubmit} className="w-full bg-[#DFFF00] text-black font-bold py-3 rounded-xl hover:bg-[#cce600]">
                                Save Menu Item
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
