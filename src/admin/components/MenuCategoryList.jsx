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
        <div className="text-ink pb-20 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-2xl font-bold text-ink">Categories</h2>
                    {isSaving && <span className="text-xs text-brandDark animate-pulse">Saving order...</span>}
                </div>
                <button onClick={handleCreate} className="bg-brand text-ink px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brandDark border border-brandDark/10 shadow-sm transition-colors">
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-paper w-full max-w-sm rounded-2xl border border-gray-200 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-ink">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-subInk hover:text-ink" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-subInk mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-canvas border border-gray-200 rounded-lg p-3 text-ink focus:border-brand outline-none transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-subInk mb-1">Display Order</label>
                                <input
                                    type="number"
                                    value={formData.display_order}
                                    onChange={e => setFormData({ ...formData, display_order: e.target.value })}
                                    className="w-full bg-canvas border border-gray-200 rounded-lg p-3 text-ink focus:border-brand outline-none transition-colors"
                                />
                            </div>
                            <button type="submit" className="w-full bg-brand text-ink font-bold py-3 rounded-xl hover:bg-brandDark mt-2 shadow-lg shadow-brand/20">
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
            className="bg-paper border border-gray-200 p-4 rounded-xl flex items-center justify-between group relative select-none hover:border-brand/50 hover:shadow-sm transition-all"
        >
            <div className="flex items-center gap-4">
                {/* Drag Handle */}
                <div 
                    onPointerDown={(e) => controls.start(e)}
                    className="bg-gray-100 w-8 h-8 rounded flex items-center justify-center text-subInk cursor-grab active:cursor-grabbing hover:bg-gray-200 transition-colors touch-none"
                >
                    <GripVertical size={16} />
                </div>
                <div>
                     <span className="font-bold text-lg text-ink">{category.name}</span>
                     {/* Debug or Order Info */}
                     <span className="text-xs text-subInk block">Order: {category.display_order}</span>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={onEdit} className="p-2 text-subInk hover:text-brandDark bg-transparent hover:bg-brand/10 rounded-lg transition-colors"><Edit2 size={16} /></button>
                <button onClick={onDelete} className="p-2 text-subInk hover:text-red-500 bg-transparent hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
            </div>
        </Reorder.Item>
    )
}
