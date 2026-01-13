import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Package, ChefHat, Calendar, AlertTriangle, Edit2, X, Save, Plus, Trash2, Upload, Image as ImageIcon, GripVertical, Eye, EyeOff } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Utility: Resize Image
const resizeImage = (file, maxWidth = 800) => {
    return new Promise((resolve) => {
        if (!file) return resolve(null)
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target.result
            img.onload = () => {
                const elem = document.createElement('canvas')
                let width = img.width
                let height = img.height

                if (width > maxWidth) {
                    height *= maxWidth / width
                    width = maxWidth
                }

                elem.width = width
                elem.height = height
                const ctx = elem.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)
                
                ctx.canvas.toBlob((blob) => {
                    const resizedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    })
                    resolve(resizedFile)
                }, 'image/jpeg', 0.8) // 0.8 quality
            }
        }
    })
}


// Draggable Side Dish Item
const SortableSideDishItem = ({ id, item, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group w-32 h-32 bg-gray-800 rounded-xl overflow-hidden border border-white/10">
            <img src={item.url} alt="Side Dish" className="w-full h-full object-cover" />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 bg-white/10 rounded-full hover:bg-white/20">
                    <GripVertical size={16} />
                </div>
                <button onClick={() => onRemove(id)} className="p-1 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors">
                    <Trash2 size={16} />
                </button>
            </div>
            {/* Label */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-center py-1 truncate px-1">
                {item.name}
            </div>
        </div>
    );
};

// Modal Component for Editing Steak
const EditSteakModal = ({ isOpen, onClose, steak, onSave, onDelete }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        current_image_url: ''
    })
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const fileInputRef = useRef(null)

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: steak?.name || '',
                price: steak?.price || '',
                description: steak?.description || '',
                current_image_url: steak?.image_url || ''
            })
            setImageFile(null)
            setImagePreview(null)
        }
    }, [isOpen, steak])

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setImageFile(file)
            setImagePreview(URL.createObjectURL(file))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            await onSave({
                id: steak?.id, // ID will be undefined for new items
                ...formData
            }, imageFile)
        } catch (error) {
            console.error("Save error", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#111]">
                    <h2 className="font-bold text-lg">{steak ? 'Edit Steak Cut' : 'Add New Cut'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {/* Image Upload Section */}
                    <div className="flex justify-center mb-4">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-40 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#DFFF00] hover:bg-white/5 transition-all overflow-hidden relative"
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                                className="hidden" 
                                accept="image/*"
                            />
                            {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                            ) : formData.current_image_url ? (
                                <img src={formData.current_image_url} className="w-full h-full object-cover" alt="Current" />
                            ) : (
                                <div className="text-center text-gray-500">
                                    <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                                    <span className="text-xs font-bold uppercase block">Upload Photo</span>
                                </div>
                            )}
                            
                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Upload size={24} className="text-white" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Name</label>
                        <input 
                            type="text" 
                            className="w-full bg-black border border-white/20 rounded-lg p-3 outline-none focus:border-[#DFFF00] placeholder-gray-600"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            placeholder="e.g. Ribeye A5"
                            required
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Recommended max 20 characters to prevent bad wrapping.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Price (THB)</label>
                        <input 
                            type="number" 
                            className="w-full bg-black border border-white/20 rounded-lg p-3 outline-none focus:border-[#DFFF00] placeholder-gray-600"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                            placeholder="e.g. 1500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Description / Details</label>
                        <textarea 
                            className="w-full bg-black border border-white/20 rounded-lg p-3 outline-none focus:border-[#DFFF00] h-24 resize-none placeholder-gray-600"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder="e.g. 300g, Intense marbling..."
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Recommended max 80 characters (2 lines).</p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        {steak && (
                             <button 
                                type="button" 
                                onClick={() => onDelete(steak.id)} 
                                className="bg-red-500/10 text-red-500 py-3 px-4 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors"
                                title="Delete Item"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        
                         <button type="button" onClick={onClose} className="flex-1 bg-white/5 py-3 rounded-xl font-bold hover:bg-white/10 transition-colors">Cancel</button>
                         <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="flex-1 bg-[#DFFF00] text-black py-3 rounded-xl font-bold hover:bg-[#cce600] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save size={18} /> {steak ? 'Save Changes' : 'Create Cut'}
                                </>
                            )}
                         </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default function AdminSteakDashboard() {
    const [steaks, setSteaks] = useState([])
    const [prepList, setPrepList] = useState([])
    const [activeTab, setActiveTab] = useState('stock') 
    const [loading, setLoading] = useState(true)
    
    // Edit Modal State
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)

    // Side Dish State
    const [sideDishes, setSideDishes] = useState([])
    const [sideDishEnabled, setSideDishEnabled] = useState(false)
    const [isSavingSides, setIsSavingSides] = useState(false)
    
    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchSteaks = async () => {
        const { data } = await supabase.from('menu_items')
            .select('*')
            .eq('category', 'Steak Pre-order')
            .order('name')
        setSteaks(data || [])
    }

    const fetchPrepList = async () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dateStr = tomorrow.toISOString().split('T')[0]
        const start = `${dateStr}T00:00:00+07:00`
        const end = `${dateStr}T23:59:59+07:00`

        const { data: bookings } = await supabase
            .from('bookings')
            .select(`
                id, pickup_contact_name, booking_time, pax, table_id, customer_note, status,
                order_items (
                    quantity, selected_options,
                    menu_items (name, category)
                )
            `)
            .gte('booking_time', start)
            .lte('booking_time', end)
            .neq('status', 'cancelled')
        
        const list = (bookings || []).filter(b => 
            b.order_items.some(oi => oi.menu_items?.category === 'Steak Pre-order')
        ).map(b => ({
            ...b,
            steak_items: b.order_items.filter(oi => oi.menu_items?.category === 'Steak Pre-order')
        }))

        setPrepList(list)
    }

    const fetchSideDishes = async () => {
        const { data } = await supabase.from('app_settings').select('*').in('key', ['side_dish_config', 'side_dish_enabled'])
        if (data) {
            const config = data.find(s => s.key === 'side_dish_config')
            const enabled = data.find(s => s.key === 'side_dish_enabled')
            
            if (config) {
                try {
                    setSideDishes(JSON.parse(config.value))
                } catch (e) { console.error("Parse error", e) }
            }
            if (enabled) {
                setSideDishEnabled(enabled.value === 'true')
            }
        }
    }

    useEffect(() => {
        Promise.all([fetchSteaks(), fetchPrepList(), fetchSideDishes()]).then(() => setLoading(false))
    }, [])

    const toggleStock = async (id, currentStatus) => {
        const { error } = await supabase.from('menu_items')
            .update({ is_sold_out: !currentStatus })
            .eq('id', id)
        
        if (!error) {
            setSteaks(prev => prev.map(s => s.id === id ? { ...s, is_sold_out: !currentStatus } : s))
        }
    }

    const openEdit = (item) => {
        setEditingItem(item)
        setIsEditOpen(true)
    }

    const openAdd = () => {
        setEditingItem(null)
        setIsEditOpen(true)
    }

    const handleSaveEdit = async (itemData, newImageFile) => {
        try {
            let imageUrl = itemData.current_image_url

            // 1. Upload new image if present
            if (newImageFile) {
                const resizedFile = await resizeImage(newImageFile)
                const fileName = `steak_${Date.now()}.jpg`
                const { error: uploadError } = await supabase.storage.from('public-assets').upload(fileName, resizedFile)
                if (uploadError) throw uploadError
                const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)
                imageUrl = publicUrl
            }

            const payload = {
                name: itemData.name,
                price: parseFloat(itemData.price),
                description: itemData.description,
                image_url: imageUrl,
                category: 'Steak Pre-order' // Ensure category is set
            }

            if (itemData.id) {
                // UPDATE
                const { error } = await supabase.from('menu_items')
                    .update(payload)
                    .eq('id', itemData.id)
                if (error) throw error
                
                setSteaks(prev => prev.map(s => s.id === itemData.id ? { ...s, ...payload } : s))
            } else {
                // CREATE
                const { data, error } = await supabase.from('menu_items')
                    .insert(payload)
                    .select()
                    .single()
                if (error) throw error
                
                setSteaks(prev => [...prev, data])
            }

            setIsEditOpen(false)
            setEditingItem(null)

        } catch (error) {
             alert('Error saving steak: ' + error.message)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this cut? This action cannot be undone.")) return

        const { error } = await supabase.from('menu_items').delete().eq('id', id)
        if (error) {
            alert("Error deleting: " + error.message)
        } else {
            setSteaks(prev => prev.filter(s => s.id !== id))
            setIsEditOpen(false)
            setEditingItem(null)
        }
    }

    // Side Dish Handlers
    const handleSideDishUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return
        
        setIsSavingSides(true)
        try {
            const newItems = []
            for (const file of files) {
                const resized = await resizeImage(file, 400) // Small thumbnail needed
                const fileName = `sidedish_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
                
                const { error } = await supabase.storage.from('public-assets').upload(fileName, resized)
                if (error) throw error
                
                const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)
                
                // Prompt for name (simple for now, default to filename or ingredient)
                // In a real app we might want a modal. For now, empty or basic.
                // We'll add a way to rename later if needed or just use tooltip same as name.
                // Actually the user wants "Hidden Joy" tooltip.
                
                newItems.push({
                    id: crypto.randomUUID(),
                    url: publicUrl,
                    name: file.name.split('.')[0], // Default name
                    active: true
                })
            }
            
            const updatedList = [...sideDishes, ...newItems]
            setSideDishes(updatedList) // Optimistic
            await saveSideDishConfig(updatedList)
            
        } catch (err) {
            alert("Upload failed: " + err.message)
        } finally {
            setIsSavingSides(false)
        }
    }

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = sideDishes.findIndex((item) => item.id === active.id);
            const newIndex = sideDishes.findIndex((item) => item.id === over.id);
            const newOrder = arrayMove(sideDishes, oldIndex, newIndex)
            setSideDishes(newOrder);
            saveSideDishConfig(newOrder);
        }
    };
    
    const handleRemoveSideDish = (id) => {
        if(!confirm("Remove this side dish?")) return
        const newList = sideDishes.filter(i => i.id !== id)
        setSideDishes(newList)
        saveSideDishConfig(newList)
    }
    
    const toggleGlobalSideDishes = async () => {
        const newValue = !sideDishEnabled
        setSideDishEnabled(newValue) 
        
        // Save to DB using upsert to handle both insert and update atomically
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key: 'side_dish_enabled', value: String(newValue) }, { onConflict: 'key' })

        if (error) {
            console.error("Error saving side_dish_enabled:", error)
            // Revert state if error? Or just alert.
        }
    }

    const saveSideDishConfig = async (list) => {
        const json = JSON.stringify(list)
        
        // Use upsert for atomic update
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key: 'side_dish_config', value: json }, { onConflict: 'key' })
            
        if (error) {
            console.error("Error saving side_dish_config:", error)
        }
    }
    
    const updateSideDishName = (id, newName) => {
        const newList = sideDishes.map(i => i.id === id ? { ...i, name: newName } : i)
        setSideDishes(newList)
        // No auto-save on typing, user must click Save
    }

    const handleManualSave = async () => {
        setIsSavingSides(true)
        await saveSideDishConfig(sideDishes)
        setTimeout(() => setIsSavingSides(false), 500)
    }

    return (
        <div className="min-h-screen bg-black pb-20 text-white font-sans">
             <header className="bg-[#111] border-b border-white/10 sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="text-gray-400 hover:text-white transition-colors">← Dashboard</Link>
                    <h1 className="text-xl font-bold">Steak Manager</h1>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6">
                {/* Tabs */}
                {/* ... (Tabs Content Omitted for brevity, unchanged) ... */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between items-start sm:items-center">
                    <div className="flex bg-[#1a1a1a] rounded-full p-1 border border-white/10">
                        <button 
                            onClick={() => setActiveTab('stock')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'stock' ? 'bg-[#DFFF00] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Package size={20} /> Stock Management
                        </button>
                         <button 
                            onClick={() => setActiveTab('prep')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'prep' ? 'bg-[#DFFF00] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <ChefHat size={20} /> Prep List (Tomorrow)
                        </button>
                        <button 
                            onClick={() => setActiveTab('sidedish')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'sidedish' ? 'bg-[#DFFF00] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <ImageIcon size={20} /> Side Dishes
                        </button>
                    </div>

                    {activeTab === 'stock' && (
                        <button 
                            onClick={openAdd}
                            className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-full font-bold flex items-center gap-2 transition-colors border border-white/10"
                        >
                            <Plus size={20} /> Add New Cut
                        </button>
                    )}
                </div>

                {loading ? <div className="text-gray-500">Loading...</div> : (
                    <>
                        {activeTab === 'stock' && (
           /* ... existing stock content ... */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {steaks.map(steak => (
                                    <div key={steak.id} className={`bg-[#1a1a1a] rounded-xl p-4 border transition-all relative group ${steak.is_sold_out ? 'border-red-900 opacity-60' : 'border-white/10'}`}>
                                        
                                        {/* Edit Button (Visible on Hover/Always on Mobile) */}
                                        <button 
                                            onClick={() => openEdit(steak)}
                                            className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-[#DFFF00] hover:text-black rounded-full transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 z-10 backdrop-blur-sm"
                                            title="Edit Details"
                                        >
                                            <Edit2 size={16} />
                                        </button>

                                        <div className="flex justify-between items-start mb-4 pr-8">
                                            <h3 className="font-bold text-lg leading-tight">{steak.name}</h3>
                                        </div>
                                        
                                        {/* Optional Image Preview */}
                                        <div className="h-40 w-full bg-gray-900 rounded-lg mb-4 overflow-hidden relative">
                                            {steak.image_url ? (
                                                <img src={steak.image_url} alt={steak.name} className="w-full h-full object-cover opacity-90 transition-transform group-hover:scale-105" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-700">
                                                    <ImageIcon size={32} />
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-xs text-gray-400 mb-4 line-clamp-2 h-8">{steak.description}</p>

                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="font-mono font-bold text-[#DFFF00]">฿{steak.price.toLocaleString()}</span>
                                            <button 
                                                onClick={() => toggleStock(steak.id, steak.is_sold_out)}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${steak.is_sold_out ? 'bg-red-500 text-white' : 'bg-green-600/20 text-green-400 border border-green-600/30'}`}
                                            >
                                                {steak.is_sold_out ? 'SOLD OUT' : 'Available'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {steaks.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-gray-500 border-2 border-dashed border-white/10 rounded-2xl">
                                        No steak items found. Click "Add New Cut" to start.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'prep' && (
                            /* ... existing prep content ... */
                            <div className="space-y-4">
                                <h2 className="text-gray-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                    <Calendar size={16} /> Pre-orders for Tomorrow
                                </h2>
                                {prepList.length === 0 ? (
                                    <div className="p-8 bg-[#1a1a1a] rounded-xl text-center text-gray-500">No Pre-orders for tomorrow.</div>
                                ) : (
                                    prepList.map(booking => (
                                        <div key={booking.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
                                            <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                                                <div>
                                                    <div className="font-bold text-lg text-[#DFFF00]">{booking.pickup_contact_name}</div>
                                                    <div className="text-sm text-gray-400">{booking.booking_time ? new Date(booking.booking_time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : '-'} • {booking.pax} Pax</div>
                                                </div>
                                                <div className="px-3 py-1 bg-white/10 rounded text-xs">
                                                    Zone: {booking.table_id ? 'Table Allocated' : 'Unknown'}
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                {booking.steak_items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded-lg">
                                                        <div className="flex items-center gap-3">
                                                            <div className="font-bold text-white bg-white/10 w-8 h-8 flex items-center justify-center rounded-lg">{item.quantity}</div>
                                                            <div>
                                                                <div className="font-bold">{item.menu_items?.name}</div>
                                                                <div className="text-xs text-gray-400">
                                                                    Doneness: <span className="text-[#DFFF00] uppercase font-bold">{item.selected_options?.Doneness || 'Standard'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {booking.customer_note && (
                                                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-lg text-yellow-200 text-sm whitespace-pre-wrap">
                                                    <AlertTriangle size={14} className="inline mr-2" />
                                                    {booking.customer_note}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'sidedish' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between bg-[#1a1a1a] p-6 rounded-2xl border border-white/10">
                                    <div>
                                        <h2 className="text-xl font-bold mb-1">Side Dish Configuration</h2>
                                        <p className="text-gray-400 text-sm">Manage the side dishes shown on Steak cards globally.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button 
                                            onClick={handleManualSave}
                                            disabled={isSavingSides}
                                            className="bg-[#DFFF00] text-black px-6 py-2 rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
                                        >
                                            {isSavingSides ? 'Saving...' : 'Save Changes'}
                                        </button>

                                        <div className="h-8 w-px bg-white/10 mx-2"></div>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <span className={`text-sm font-bold ${sideDishEnabled ? 'text-[#DFFF00]' : 'text-gray-500'}`}>
                                                {sideDishEnabled ? 'VISIBLE TO CUSTOMERS' : 'HIDDEN'}
                                            </span>
                                            <button 
                                                onClick={toggleGlobalSideDishes}
                                                className={`w-14 h-8 rounded-full p-1 transition-colors ${sideDishEnabled ? 'bg-[#DFFF00]' : 'bg-gray-700'}`}
                                            >
                                                <div className={`w-6 h-6 bg-black rounded-full shadow-md transition-transform ${sideDishEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </button>
                                        </label>
                                    </div>
                                </div>
                                
                                <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-white/10 min-h-[400px]">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold flex items-center gap-2"><GripVertical size={16} /> Drag to Reorder</h3>
                                        <label className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-sm cursor-pointer flex items-center gap-2 transition-colors">
                                            <Plus size={16} /> Add Image
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleSideDishUpload} />
                                        </label>
                                    </div>
                                    
                                    <DndContext 
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext 
                                            items={sideDishes.map(i => i.id)}
                                            strategy={horizontalListSortingStrategy}
                                        >
                                            <div className="flex flex-wrap gap-4">
                                                {sideDishes.map(item => (
                                                    <div key={item.id} className="relative group">
                                                        <SortableSideDishItem id={item.id} item={item} onRemove={handleRemoveSideDish} />
                                                        <input 
                                                            type="text" 
                                                            value={item.name}
                                                            onChange={(e) => updateSideDishName(item.id, e.target.value)}
                                                            className="w-32 mt-2 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-center focus:border-[#DFFF00] outline-none"
                                                            placeholder="Tooltip Name"
                                                        />
                                                    </div>
                                                ))}
                                                {sideDishes.length === 0 && (
                                                    <div className="w-full py-20 text-center text-gray-500 border-2 border-dashed border-white/10 rounded-xl">
                                                        No side dishes. Upload images to get started.
                                                    </div>
                                                )}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                    
                                    {/* Preview Section */}
                                    <div className="mt-12 pt-12 border-t border-white/10">
                                        <h3 className="font-bold mb-4 text-gray-400 uppercase text-xs">Live Preview (Mockup)</h3>
                                        <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden text-black p-4 border border-gray-200 opacity-90 mx-auto sm:mx-0">
                                            <div className="aspect-[4/3] bg-gray-200 rounded-lg mb-3 relative overflow-hidden">
                                                <div className="absolute inset-0 flex items-center justify-center text-gray-400">Steak Image</div>
                                                
                                                {/* SIDE DISH PREVIEW */}
                                                {sideDishEnabled && sideDishes.length > 0 && (
                                                   <div className="absolute bottom-2 left-2 right-2 flex gap-1 justify-center z-20">
                                                        {sideDishes.map(sd => (
                                                            <div key={sd.id} className="w-10 h-10 rounded-md overflow-hidden border border-white shadow-sm relative group/sd bg-white">
                                                                <img src={sd.url} className="w-full h-full object-cover" />
                                                                {/* Tooltip Preview */}
                                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/sd:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                                                                    {sd.name}
                                                                </div>
                                                            </div>
                                                        ))}
                                                   </div> 
                                                )}
                                            </div>
                                            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                                            <div className="h-3 bg-gray-100 rounded w-full mb-4"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal Portal */}
            <EditSteakModal 
                isOpen={isEditOpen} 
                onClose={() => setIsEditOpen(false)} 
                steak={editingItem}
                onSave={handleSaveEdit}
                onDelete={handleDelete}
            />
        </div>
    )
}
