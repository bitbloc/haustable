import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, Move } from 'lucide-react'

export default function MenuCategoryList() {
    const [categories, setCategories] = useState([])
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
        setFormData({ name: '', display_order: categories.length + 1 })
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
        fetchCategories()
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

    return (
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Categories</h2>
                <button onClick={handleCreate} className="bg-[#DFFF00] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#b0cc00]">
                    <Plus size={18} /> New Category
                </button>
            </div>

            <div className="grid gap-3">
                {categories.map((cat) => (
                    <div key={cat.id} className="bg-[#1a1a1a] border border-white/10 p-4 rounded-xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="bg-black w-8 h-8 rounded flex items-center justify-center text-gray-500 cursor-move">
                                <span className="font-mono text-xs font-bold">{cat.display_order}</span>
                            </div>
                            <span className="font-bold text-lg">{cat.name}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(cat)} className="p-2 text-gray-400 hover:text-[#DFFF00]"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete(cat.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
            </div>

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
