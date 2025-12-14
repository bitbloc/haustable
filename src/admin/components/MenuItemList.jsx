import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Check, Star, AlertCircle, Camera } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function MenuItemList() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [optionGroups, setOptionGroups] = useState([])

    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [imageFile, setImageFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [imageRemoved, setImageRemoved] = useState(false) // New state to track removal

    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category_id: '',
        description: '',
        is_available: true,
        is_recommended: false
    })

    const [selectedOptionGroups, setSelectedOptionGroups] = useState([])
    const [activeTab, setActiveTab] = useState('normal') // normal, custom (though we only use normal for now)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const [menuRes, catRes, optRes] = await Promise.all([
            // Lazy Load: Don't fetch nested options here, too slow. Fetch on edit.
            supabase.from('menu_items').select(`
                *,
                menu_categories (name)
            `).order('created_at', { ascending: false }),
            supabase.from('menu_categories').select('*').order('display_order'),
            supabase.from('option_groups').select('*').order('name')
        ])

        if (menuRes.data) setMenuItems(menuRes.data)
        if (catRes.data) setCategories(catRes.data)
        if (optRes.data) setOptionGroups(optRes.data)
        setLoading(false)
    }

    setSelectedOptionGroups([])
    setImageFile(null)
    setPreviewUrl(null)
    setImageRemoved(false)
    setIsModalOpen(true)
}

const handleEdit = async (item) => {
    setEditingItem(item)
    setFormData({
        name: item.name,
        price: item.price,
        category_id: item.category_id || categories.find(c => c.name === item.category)?.id || '',
        description: item.description || '',
        is_available: item.is_available,
        is_recommended: item.is_recommended
    })

    // Lazy Load Options
    const { data: options } = await supabase.from('menu_item_options')
        .select('option_group_id, display_order')
        .eq('menu_item_id', item.id)
        .order('display_order')

    const linkedGroups = options?.map(o => o.option_group_id) || []
    setSelectedOptionGroups(linkedGroups)

    setImageFile(null)
    setPreviewUrl(item.image_url)
    setImageRemoved(false)
    setIsModalOpen(true)
}

// Resize Utility
const resizeImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target.result
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const MAX_WIDTH = 800
                const MAX_HEIGHT = 800
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width
                        width = MAX_WIDTH
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height
                        height = MAX_HEIGHT
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                        type: "image/jpeg",
                        lastModified: Date.now(),
                    }))
                }, 'image/jpeg', 0.85) // 85% quality JPG
            }
        }
    })
}

const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
        try {
            const resizedFile = await resizeImage(file)
            setImageFile(resizedFile)
            setPreviewUrl(URL.createObjectURL(resizedFile))
            setImageRemoved(false)
        } catch (err) {
            console.error("Resize error", err)
            // Fallback
            setImageFile(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }
}

const handleRemoveImage = (e) => {
    e.stopPropagation()
    setImageFile(null)
    setPreviewUrl(null)
    setImageRemoved(true)
}

const handleDelete = async (id) => {
    if (!confirm('ยืนยันการลบเมนูนี้? (Delete this menu item?)')) return
    await supabase.from('menu_items').delete().eq('id', id)
    fetchData()
}

const handleSubmit = async (e) => {
    e.preventDefault()
    try {
        let imageUrl = editingItem?.image_url || ''

        if (imageRemoved) {
            imageUrl = '' // Clear image
        }

        if (imageFile) {
            const fileName = `menu_${Date.now()}.jpg`
            // Upload
            const { error } = await supabase.storage.from('public-assets').upload(fileName, imageFile)
            if (error) throw error
            const { data } = supabase.storage.from('public-assets').getPublicUrl(fileName)
            imageUrl = data.publicUrl
        }

        const selectedCatName = categories.find(c => c.id === formData.category_id)?.name || 'Main'

        const payload = {
            name: formData.name,
            price: parseFloat(formData.price),
            category_id: formData.category_id || null,
            category: selectedCatName,
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
        if (newItemId) {
            await supabase.from('menu_item_options').delete().eq('menu_item_id', newItemId)
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

        // Optimistic Update
        const finalItem = {
            id: newItemId,
            ...payload,
            image_url: imageUrl,
            menu_categories: { name: selectedCatName },
            // options not critical for list view
        }

        if (editingItem) {
            setMenuItems(prev => prev.map(i => i.id === newItemId ? finalItem : i))
        } else {
            setMenuItems(prev => [finalItem, ...prev])
        }

        setIsModalOpen(false)
        // No full fetchData reload needed!

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

// New Component: Option Picker Modal (nested or integrated) - using integrated list for now as per image 2
// The image shows "Add Option Group" opening a picker, but we can list them cleaner.

return (
    <div className="text-white pb-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold">Menu Items</h2>
                <p className="text-gray-500 text-sm">จัดการเมนูอาหารและเครื่องดื่ม</p>
            </div>
            <button onClick={handleCreate} className="bg-[#DFFF00] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#b0cc00]">
                <Plus size={18} /> เพิ่มเมนู
            </button>
        </div>

        {/* List View */}
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
                                <div key={item.id} className="group bg-[#1a1a1a] border border-white/5 rounded-xl p-3 flex gap-4 hover:border-white/20 transition-all cursor-pointer" onClick={() => handleEdit(item)}>
                                    <div className="w-20 h-20 bg-black rounded-lg overflow-hidden shrink-0 relative">
                                        {item.image_url ? (
                                            <img src={item.image_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-700"><ImageIcon size={20} /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold truncate text-base">{item.name}</h4>
                                                <span className="text-[#DFFF00] font-mono font-bold">{item.price}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 line-clamp-1 mt-1">{item.description || 'ไม่มีคำอธิบาย'}</div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            {item.is_recommended && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded flex items-center gap-1"><Star size={8} fill="currentColor" /> แนะนำ</span>}
                                            {!item.is_available && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">หมด</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>

        {/* Edit/Create Modal - Full Screen Mobile Style adapted to Desktop */}
        <AnimatePresence>
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="bg-[#1a1a1a] w-full max-w-2xl h-full md:h-auto md:max-h-[85vh] md:rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a] z-10">
                            <h2 className="text-xl font-bold">{editingItem ? 'แก้ไขเมนู' : 'เพิ่มเมนู'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="text-white" /></button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Image Cover */}
                            <div className="w-full h-48 bg-[#111] relative group cursor-pointer" onClick={() => document.getElementById('menu-image-upload').click()}>
                                {previewUrl ? (
                                    <img src={previewUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 group-hover:bg-white/5 transition-colors">
                                        <ImageIcon size={48} className="mb-2 opacity-50" />
                                        <span className="text-sm">เพิ่มรูปภาพเมนู</span>
                                        <span className="text-xs text-gray-500 mt-1">Resize auto (max 800px)</span>
                                    </div>
                                )}

                                {/* Image Controls */}
                                <div className="absolute top-2 right-2 flex gap-2">
                                    {previewUrl && (
                                        <button
                                            onClick={handleRemoveImage}
                                            className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm shadow-lg transition-transform hover:scale-105"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>

                                <div className="absolute bottom-3 right-3 pointer-events-none">
                                    <span className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-2 border border-white/10">
                                        <Camera size={14} /> {previewUrl ? 'แตะเพื่อเปลี่ยนรูป' : 'แตะเพื่อเพิ่มรูป'}
                                    </span>
                                </div>
                                <input id="menu-image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Name Input */}
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-transparent border-b border-white/20 p-2 text-xl font-bold text-white placeholder-gray-600 focus:border-[#DFFF00] outline-none transition-colors"
                                        placeholder="ชื่อเมนู (ภาษาไทย)"
                                        required
                                    />
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-b border-white/20 p-2 text-sm text-gray-300 placeholder-gray-600 focus:border-[#DFFF00] outline-none transition-colors"
                                        placeholder="ชื่อเมนู (ภาษาอังกฤษ - ถ้ามี)"
                                    />
                                </div>

                                {/* Category Dropdown */}
                                <div className="relative">
                                    <select
                                        value={formData.category_id}
                                        onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                        className="w-full bg-[#222] border border-white/10 rounded-xl p-4 text-white appearance-none outline-none focus:border-[#DFFF00]"
                                    >
                                        <option value="">เลือกหมวดหมู่</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                                </div>

                                {/* Price Section */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">ราคาขาย</label>
                                    <div className="flex gap-2 mb-4 bg-[#222] p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('normal')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'normal' ? 'bg-[#DFFF00] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            ราคาปกติ
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('custom')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'custom' ? 'bg-[#DFFF00] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            ราคากำหนดเอง
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 bg-[#222] rounded-xl p-4 border border-white/5">
                                        <span className="font-bold">ราคา</span>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            className="flex-1 bg-transparent text-right font-mono text-xl font-bold outline-none placeholder-gray-600"
                                            placeholder="0.00"
                                        />
                                        <span className="text-gray-500">฿</span>
                                    </div>
                                </div>

                                {/* Option Groups */}
                                <div className="bg-[#222] rounded-xl p-4 border border-white/5">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-base">กลุ่มตัวเลือก (Options)</h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // This usually opens a picker modal, but for simplicity/speed let's just toggle visibility of all options below or a separate small modal?
                                                // Let's verify how to best UX this. A small inline picker is good.
                                                const picker = document.getElementById('option-picker')
                                                if (picker) picker.classList.toggle('hidden')
                                            }}
                                            className="text-[#DFFF00] text-xs font-bold flex items-center gap-1"
                                        >
                                            <Plus size={14} /> เพิ่มกลุ่มตัวเลือก
                                        </button>
                                    </div>

                                    {/* Selected Options List */}
                                    <div className="space-y-2 mb-4">
                                        {selectedOptionGroups.map(gid => {
                                            const group = optionGroups.find(g => g.id === gid)
                                            if (!group) return null
                                            return (
                                                <div key={gid} className="bg-[#333] p-3 rounded-lg flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold text-sm">{group.name}</div>
                                                        <div className="text-xs text-gray-400">
                                                            {group.selection_type === 'single' ? 'เลือก 1' : 'หลายข้อ'} • {group.is_required ? 'บังคับ' : 'ไม่บังคับ'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {group.is_required && <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">ต้องเลือก</span>}
                                                        <button onClick={() => toggleOptionGroup(gid)}><X size={16} className="text-gray-400 hover:text-red-500" /></button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {selectedOptionGroups.length === 0 && <p className="text-center text-gray-500 text-sm py-4">ยังไม่ได้เลือก Option เสริม</p>}
                                    </div>

                                    {/* Inline Picker (Hidden by default) */}
                                    <div id="option-picker" className="hidden border-t border-white/10 pt-4 mt-4">
                                        <div className="text-xs text-gray-400 mb-2 font-bold">เลือกกลุ่มตัวเลือกที่ต้องการเพิ่ม:</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {optionGroups.filter(g => !selectedOptionGroups.includes(g.id)).map(g => (
                                                <button
                                                    key={g.id}
                                                    onClick={() => toggleOptionGroup(g.id)}
                                                    className="text-left text-xs p-2 bg-black border border-white/10 rounded hover:border-[#DFFF00] hover:text-[#DFFF00]"
                                                >
                                                    {g.name}
                                                </button>
                                            ))}
                                            {optionGroups.filter(g => !selectedOptionGroups.includes(g.id)).length === 0 && (
                                                <span className="text-gray-500 text-xs col-span-2">เลือกครบแล้ว หรือยังไม่ได้สร้างกลุ่มตัวเลือก</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Toggles */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${formData.is_recommended ? 'bg-[#DFFF00]/20 text-[#DFFF00]' : 'bg-gray-800 text-gray-500'}`}><Star size={20} /></div>
                                            <div>
                                                <div className="font-bold text-sm">เมนูแนะนำ</div>
                                                <div className="text-xs text-gray-500">แสดงดาวแนะนำบนเมนูนี้</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={formData.is_recommended} onChange={e => setFormData({ ...formData, is_recommended: e.target.checked })} className="w-5 h-5 accent-[#DFFF00]" />
                                    </div>

                                    <div className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${formData.is_available ? 'bg-green-500/20 text-green-500' : 'bg-gray-800 text-gray-500'}`}><Check size={20} /></div>
                                            <div>
                                                <div className="font-bold text-sm">เปิดขายเมนูนี้</div>
                                                <div className="text-xs text-gray-500">เมื่อปิด ลูกค้าจะสั่งไม่ได้</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={formData.is_available} onChange={e => setFormData({ ...formData, is_available: e.target.checked })} className="w-5 h-5 accent-[#DFFF00]" />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">คำอธิบายเมนู</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-[#222] border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 focus:border-[#DFFF00] outline-none resize-none h-32"
                                        placeholder="ใส่รายละเอียดเมนู เช่น ส่วนประกอบ รสชาติ..."
                                    ></textarea>
                                </div>

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 bg-[#111] z-10">
                            <button onClick={handleSubmit} className="w-full bg-[#DFFF00] text-black font-bold py-3 rounded-xl hover:bg-[#cce600] shadow-lg shadow-[#DFFF00]/20">
                                บันทึกเมนู
                            </button>
                            {editingItem && (
                                <button onClick={() => handleDelete(editingItem.id)} className="w-full mt-2 text-red-500 text-xs font-bold py-2 hover:underline">
                                    ลบเมนูนี้
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
)
}
