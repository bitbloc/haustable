import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Package, ChefHat, Calendar, AlertTriangle, Edit2, X, Save, Plus, Trash2, Upload, Image as ImageIcon } from 'lucide-react'

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

    useEffect(() => {
        Promise.all([fetchSteaks(), fetchPrepList()]).then(() => setLoading(false))
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
