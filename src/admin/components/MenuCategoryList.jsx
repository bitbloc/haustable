import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, GripVertical } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'

export default function MenuCategoryList() {
    const [categories, setCategories] = useState([])
    // We keep a separate loading state for order saving to avoid full re-renders or UI block
    const [isSaving, setIsSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState(null)
    const [formData, setFormData] = useState({ name: '', display_order: 0 })

    useEffect(() => {
        fetchCategories()
    }, [])

    const fetchCategories = async () => {
        setLoading(true)
        const { data, error } = await supabase.from('menu_categories').select('*').order('display_order', { ascending: true })
        if (error) console.error(error)
        else setCategories(data || [])
        setLoading(false)
    }

    const handleCreate = () => {
        setEditingCategory(null)
        // Default order is last
        const maxOrder = Math.max(...categories.map(c => c.display_order), 0)
        setFormData({ name: '', display_order: maxOrder + 1 })
        setIsModalOpen(true)
    }

    const handleEdit = (cat) => {
        setEditingCategory(cat)
        setFormData({ name: cat.name, display_order: cat.display_order })
        setIsModalOpen(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? Deleting a category usually requires re-assigning items.')) return
        await supabase.from('menu_categories').delete().eq('id', id)
        // Optimistic delete
        setCategories(prev => prev.filter(c => c.id !== id))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                name: formData.name,
                display_order: parseInt(formData.display_order)
            }

            if (editingCategory) {
                await supabase.from('menu_categories').update(payload).eq('id', editingCategory.id)
            } else {
                await supabase.from('menu_categories').insert(payload)
            }
            setIsModalOpen(false)
            fetchCategories()
        } catch (error) {
            alert(error.message)
        }
    }

    // --- Drag & Drop Save Logic ---
    const handleReorder = (newOrder) => {
        setCategories(newOrder)
    }

    // Called when drag ends to save to DB
    const saveOrder = async () => {
        setIsSaving(true)
        try {
            // Prepare updates
            const updates = categories.map((cat, index) => ({
                id: cat.id,
                name: cat.name, // Required for upsert if we want to be safe, but update is better. 
                // Upsert requires all non-null columns or simpler update logic.
                // Let's use individual updates or a stored procedure ideally, 
                // but for small lists, a loop of updates or an upsert is okay.
                // Supabase upsert matches on PK.
                display_order: index + 1
            }))

            // Use upsert to batch update display_order
            const { error } = await supabase.from('menu_categories').upsert(updates, { onConflict: 'id' })
            if (error) throw error
            console.log('Order saved')
        } catch (err) {
            console.error('Failed to save order', err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-2xl font-bold">Categories</h2>
                    {isSaving && <span className="text-xs text-[#DFFF00] animate-pulse">Saving order...</span>}
                </div>
                <button onClick={handleCreate} className="bg-[#DFFF00] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#b0cc00]">
                    <Plus size={18} /> New Category
                </button>
            </div>

            <Reorder.Group axis="y" values={categories} onReorder={handleReorder} className="grid gap-3">
                {categories.map((cat) => (
                    <CategoryItem 
                        key={cat.id} 
                        category={cat} 
                        onEdit={() => handleEdit(cat)} 
                        onDelete={() => handleDelete(cat.id)}
                        onDragEnd={saveOrder}
                    />
                ))}
            </Reorder.Group>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-gray-500 hover:text-white" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black border border-white/20 rounded-lg p-3 text-white focus:border-[#DFFF00] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Display Order</label>
                                <input
                                    type="number"
                                    value={formData.display_order}
                                    onChange={e => setFormData({ ...formData, display_order: e.target.value })}
                                    className="w-full bg-black border border-white/20 rounded-lg p-3 text-white focus:border-[#DFFF00] outline-none"
                                />
                            </div>
                            <button type="submit" className="w-full bg-[#DFFF00] text-black font-bold py-3 rounded-xl hover:bg-[#cce600] mt-2">
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function CategoryItem({ category, onEdit, onDelete, onDragEnd }) {
    const controls = useDragControls()

    return (
        <Reorder.Item 
            value={category} 
            dragListener={false} 
            dragControls={controls}
            onDragEnd={onDragEnd}
            className="bg-[#1a1a1a] border border-white/10 p-4 rounded-xl flex items-center justify-between group relative select-none"
        >
            <div className="flex items-center gap-4">
                {/* Drag Handle */}
                <div 
                    onPointerDown={(e) => controls.start(e)}
                    className="bg-black w-8 h-8 rounded flex items-center justify-center text-gray-500 cursor-grab active:cursor-grabbing hover:bg-gray-800 transition-colors touch-none"
                >
                    <GripVertical size={16} />
                </div>
                <div>
                     <span className="font-bold text-lg">{category.name}</span>
                     {/* Debug or Order Info */}
                     <span className="text-xs text-gray-600 block">Order: {category.display_order}</span>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={onEdit} className="p-2 text-gray-400 hover:text-[#DFFF00]"><Edit2 size={16} /></button>
                <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
        </Reorder.Item>
    )
}
